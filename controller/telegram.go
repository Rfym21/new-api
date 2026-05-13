package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TelegramBind(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		c.JSON(200, gin.H{
			"message": "管理员未开启通过 Telegram 登录",
			"success": false,
		})
		return
	}
	params := c.Request.URL.Query()
	if !checkTelegramAuthorization(params, common.TelegramBotToken) {
		c.JSON(200, gin.H{
			"message": "无效的请求",
			"success": false,
		})
		return
	}
	telegramId := params["id"][0]
	if model.IsTelegramIdAlreadyTaken(telegramId) {
		c.JSON(200, gin.H{
			"message": "该 Telegram 账户已被绑定",
			"success": false,
		})
		return
	}

	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{Id: id.(int)}
	if err := user.FillUserById(); err != nil {
		c.JSON(200, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	if user.Id == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户已注销",
		})
		return
	}
	user.TelegramId = telegramId
	if err := user.Update(false); err != nil {
		c.JSON(200, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}

	c.Redirect(302, "/console/personal")
}

func TelegramLogin(c *gin.Context) {
	if !common.TelegramOAuthEnabled {
		c.JSON(200, gin.H{
			"message": "管理员未开启通过 Telegram 登录以及注册",
			"success": false,
		})
		return
	}
	params := c.Request.URL.Query()
	if !checkTelegramAuthorization(params, common.TelegramBotToken) {
		c.JSON(200, gin.H{
			"message": "无效的请求",
			"success": false,
		})
		return
	}

	telegramId := params["id"][0]
	user := model.User{TelegramId: telegramId}
	err := DB_Where_TelegramId(&user)
	if err != nil && !isTelegramNotFound(err) {
		c.JSON(200, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}

	if user.Id == 0 {
		// 用户不存在，按 RegisterEnabled 开关自动注册新用户
		if !common.RegisterEnabled {
			c.JSON(200, gin.H{
				"message": "管理员关闭了新用户注册",
				"success": false,
			})
			return
		}
		newUser, regErr := registerTelegramUser(c, params)
		if regErr != nil {
			c.JSON(200, gin.H{
				"message": regErr.Error(),
				"success": false,
			})
			return
		}
		user = *newUser
	}

	if user.Status != common.UserStatusEnabled {
		c.JSON(200, gin.H{
			"message": "用户已被封禁",
			"success": false,
		})
		return
	}

	setupLogin(&user, c)
}

// DB_Where_TelegramId 根据 telegram_id 查询用户，未找到时不返回错误
func DB_Where_TelegramId(user *model.User) error {
	if user.TelegramId == "" {
		return nil
	}
	err := model.DB.Where(model.User{TelegramId: user.TelegramId}).First(user).Error
	if err != nil {
		return err
	}
	return nil
}

// isTelegramNotFound 判断错误是否为记录未找到
func isTelegramNotFound(err error) bool {
	return err != nil && (err == gorm.ErrRecordNotFound || err.Error() == "record not found")
}

// registerTelegramUser 根据 Telegram 回传参数自动注册新用户
func registerTelegramUser(c *gin.Context, params map[string][]string) (*model.User, error) {
	telegramId := params["id"][0]

	tgUsername := ""
	if v, ok := params["username"]; ok && len(v) > 0 {
		tgUsername = strings.TrimSpace(v[0])
	}

	firstName := ""
	if v, ok := params["first_name"]; ok && len(v) > 0 {
		firstName = strings.TrimSpace(v[0])
	}
	lastName := ""
	if v, ok := params["last_name"]; ok && len(v) > 0 {
		lastName = strings.TrimSpace(v[0])
	}

	// 用户名优先使用 Telegram username，冲突或为空时退回到 tg_<id>
	username := ""
	fallback := "tg_" + telegramId
	if tgUsername != "" && len(tgUsername) <= model.UserNameMaxLength {
		if exists, err := model.CheckUserExistOrDeleted(tgUsername, ""); err == nil && !exists {
			username = tgUsername
		}
	}
	if username == "" {
		if exists, err := model.CheckUserExistOrDeleted(fallback, ""); err == nil && !exists {
			username = fallback
		} else {
			username = fallback + "_" + common.GetRandomString(6)
		}
	}

	// DisplayName 由 first_name + last_name 拼接，若为空则退回到 username
	displayName := strings.TrimSpace(firstName + " " + lastName)
	if displayName == "" {
		displayName = username
	}

	user := &model.User{
		Username:    username,
		DisplayName: displayName,
		TelegramId:  telegramId,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Password:    common.GetRandomString(12),
	}

	// 处理邀请码
	session := sessions.Default(c)
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		if code, ok := affCode.(string); ok && code != "" {
			inviterId, _ = model.GetUserIdByAffCode(code)
		}
	}
	if inviterId == 0 {
		if code := c.Query("aff"); code != "" {
			inviterId, _ = model.GetUserIdByAffCode(code)
		}
	}

	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := user.InsertWithTx(tx, inviterId); err != nil {
			return err
		}
		if err := tx.Model(user).Updates(map[string]interface{}{
			"telegram_id": user.TelegramId,
		}).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	user.FinalizeOAuthUserCreation(inviterId)
	return user, nil
}

func checkTelegramAuthorization(params map[string][]string, token string) bool {
	strs := []string{}
	var hash = ""
	for k, v := range params {
		if k == "hash" {
			hash = v[0]
			continue
		}
		strs = append(strs, k+"="+v[0])
	}
	sort.Strings(strs)
	var imploded = ""
	for _, s := range strs {
		if imploded != "" {
			imploded += "\n"
		}
		imploded += s
	}
	sha256hash := sha256.New()
	io.WriteString(sha256hash, token)
	hmachash := hmac.New(sha256.New, sha256hash.Sum(nil))
	io.WriteString(hmachash, imploded)
	ss := hex.EncodeToString(hmachash.Sum(nil))
	return hash == ss
}
