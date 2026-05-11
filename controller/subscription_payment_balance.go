package controller

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

/**
 * SubscriptionBalancePayRequest 用户余额购买订阅套餐的请求体。
 */
type SubscriptionBalancePayRequest struct {
	PlanId int `json:"plan_id"`
}

/**
 * SubscriptionRequestBalance 处理用户使用站内余额（user.quota）购买订阅套餐。
 *
 * 流程：
 *   1. 校验 plan 存在、已启用、AllowBalancePurchase 开关已开启；
 *   2. 校验购买上限；
 *   3. 按 plan.PriceAmount × QuotaPerUnit 计算需扣减的 quota；
 *   4. 通过 DeductUserQuotaIfSufficient 原子扣费；
 *   5. 创建 pending 状态的 SubscriptionOrder；
 *   6. 调 CompleteSubscriptionOrder 完成订阅。任意一步失败均回滚扣费。
 */
func SubscriptionRequestBalance(c *gin.Context) {
	var req SubscriptionBalancePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if !plan.AllowBalancePurchase {
		common.ApiErrorMsg(c, "该套餐未开启余额购买")
		return
	}
	if plan.PriceAmount < 0 {
		common.ApiErrorMsg(c, "套餐金额非法")
		return
	}

	userId := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	// price_amount(USD) → quota，与 topup 入账（controller/topup.go）互逆
	quotaCost := int(decimal.NewFromFloat(plan.PriceAmount).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())

	if quotaCost > 0 {
		if err := model.DeductUserQuotaIfSufficient(userId, quotaCost); err != nil {
			if errors.Is(err, model.ErrInsufficientQuota) {
				common.ApiErrorMsg(c, "余额不足")
				return
			}
			common.ApiError(c, err)
			return
		}
	}

	tradeNo := fmt.Sprintf("SUBUSR%dBAL%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodBalance,
		PaymentProvider: model.PaymentProviderBalance,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		if quotaCost > 0 {
			_ = model.IncreaseUserQuota(userId, quotaCost, true)
		}
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, "", model.PaymentProviderBalance, model.PaymentMethodBalance); err != nil {
		if quotaCost > 0 {
			_ = model.IncreaseUserQuota(userId, quotaCost, true)
		}
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderBalance)
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{"trade_no": tradeNo})
}
