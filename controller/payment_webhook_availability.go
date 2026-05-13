package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// 当前仅保留 EPay 支付，其它支付网关（Stripe / Creem / Waffo / WaffoPancake）已被移除。

func isEpayTopUpEnabled() bool {
	return isEpayWebhookConfigured() && len(operation_setting.PayMethods) > 0
}

func isEpayWebhookConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayWebhookEnabled() bool {
	return isEpayTopUpEnabled()
}
