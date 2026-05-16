package claude

import (
	"bytes"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

/**
 * Claude 渠道级强制缓存功能：
 * - 若上游请求体已包含 cache_control 标记，原样透传。
 * - 否则按 system(1)+messages(2)+tools(1) 注入 ephemeral 缓存标记。
 * - 响应阶段将 cache_creation_input_tokens、cache_read_input_tokens、
 *   cache_creation.ephemeral_* 归零，并折算回 input_tokens，避免计费偏差。
 */

const ephemeralCacheControl = `{"type":"ephemeral"}`

/**
 * InjectForceCacheControl 在 Claude 请求 JSON 中按规则注入 cache_control。
 * @param {[]byte} jsonData - 已序列化的 Claude 请求体
 * @returns {[]byte} 注入后的请求体；若原请求已含 cache_control 则原样返回
 * @returns {bool} 是否实际注入（true 表示请求体被改写；false 表示用户自带 cache_control，原样透传）
 */
func InjectForceCacheControl(jsonData []byte) ([]byte, bool) {
	if len(jsonData) == 0 {
		return jsonData, false
	}
	if bytes.Contains(jsonData, []byte(`"cache_control"`)) {
		return jsonData, false
	}

	jsonStr := string(jsonData)
	jsonStr = injectSystemCache(jsonStr)
	jsonStr = injectToolsCache(jsonStr)
	jsonStr = injectMessagesCache(jsonStr)

	return []byte(jsonStr), true
}

/**
 * injectSystemCache 为 system 字段的最后一个文本块注入 cache_control。
 * 若 system 为字符串则先转换为单元素数组结构。
 */
func injectSystemCache(jsonStr string) string {
	system := gjson.Get(jsonStr, "system")
	if !system.Exists() {
		return jsonStr
	}

	switch {
	case system.IsArray():
		arr := system.Array()
		if len(arr) == 0 {
			return jsonStr
		}
		idx := len(arr) - 1
		if patched, err := sjson.SetRaw(jsonStr, "system."+itoa(idx)+".cache_control", ephemeralCacheControl); err == nil {
			return patched
		}
	case system.Type == gjson.String:
		text := system.String()
		if text == "" {
			return jsonStr
		}
		block := map[string]interface{}{
			"type":          "text",
			"text":          text,
			"cache_control": map[string]interface{}{"type": "ephemeral"},
		}
		raw, err := common.Marshal([]interface{}{block})
		if err != nil {
			return jsonStr
		}
		if patched, err := sjson.SetRawBytes([]byte(jsonStr), "system", raw); err == nil {
			return string(patched)
		}
	}
	return jsonStr
}

/**
 * injectToolsCache 为 tools 数组的最后一个工具注入 cache_control。
 */
func injectToolsCache(jsonStr string) string {
	tools := gjson.Get(jsonStr, "tools")
	if !tools.Exists() || !tools.IsArray() {
		return jsonStr
	}
	arr := tools.Array()
	if len(arr) == 0 {
		return jsonStr
	}
	idx := len(arr) - 1
	if patched, err := sjson.SetRaw(jsonStr, "tools."+itoa(idx)+".cache_control", ephemeralCacheControl); err == nil {
		return patched
	}
	return jsonStr
}

/**
 * injectMessagesCache 为最后两条消息的最后一个内容块注入 cache_control。
 * 若 content 为字符串则先转换为单元素文本数组结构。
 */
func injectMessagesCache(jsonStr string) string {
	messages := gjson.Get(jsonStr, "messages")
	if !messages.Exists() || !messages.IsArray() {
		return jsonStr
	}
	arr := messages.Array()
	if len(arr) == 0 {
		return jsonStr
	}

	marked := 0
	for i := len(arr) - 1; i >= 0 && marked < 2; i-- {
		path := "messages." + itoa(i)
		content := gjson.Get(jsonStr, path+".content")
		if !content.Exists() {
			continue
		}
		switch {
		case content.IsArray():
			items := content.Array()
			if len(items) == 0 {
				continue
			}
			lastIdx := len(items) - 1
			blockPath := path + ".content." + itoa(lastIdx) + ".cache_control"
			if patched, err := sjson.SetRaw(jsonStr, blockPath, ephemeralCacheControl); err == nil {
				jsonStr = patched
				marked++
			}
		case content.Type == gjson.String:
			text := content.String()
			if text == "" {
				continue
			}
			block := map[string]interface{}{
				"type":          "text",
				"text":          text,
				"cache_control": map[string]interface{}{"type": "ephemeral"},
			}
			raw, err := common.Marshal([]interface{}{block})
			if err != nil {
				continue
			}
			if patched, err := sjson.SetRawBytes([]byte(jsonStr), path+".content", raw); err == nil {
				jsonStr = string(patched)
				marked++
			}
		}
	}
	return jsonStr
}

/**
 * itoa 局部整数转字符串，避免引入 strconv 依赖。
 */
func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	var buf [20]byte
	pos := len(buf)
	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}
	if neg {
		pos--
		buf[pos] = '-'
	}
	return string(buf[pos:])
}

/**
 * ApplyForceCacheUsageZeroing 将 Claude 响应 usage 中的缓存字段归零并折算回 input_tokens。
 * @param {*dto.ClaudeUsage} usage - 原始 Claude usage 结构
 */
func ApplyForceCacheUsageZeroing(usage *dto.ClaudeUsage) {
	if usage == nil {
		return
	}
	extra := usage.CacheCreationInputTokens + usage.CacheReadInputTokens
	if extra > 0 {
		usage.InputTokens += extra
	}
	usage.CacheCreationInputTokens = 0
	usage.CacheReadInputTokens = 0
	if usage.CacheCreation != nil {
		usage.CacheCreation.Ephemeral5mInputTokens = 0
		usage.CacheCreation.Ephemeral1hInputTokens = 0
	}
	usage.ClaudeCacheCreation5mTokens = 0
	usage.ClaudeCacheCreation1hTokens = 0
}

/**
 * ApplyForceCacheInternalUsage 同步内部 dto.Usage 结构，使计费仅按合并后的 input tokens 计算。
 * @param {*dto.Usage} usage - 内部统一 usage 结构
 */
func ApplyForceCacheInternalUsage(usage *dto.Usage) {
	if usage == nil {
		return
	}
	extra := usage.PromptTokensDetails.CachedTokens + usage.PromptTokensDetails.CachedCreationTokens
	if extra > 0 {
		usage.PromptTokens += extra
		usage.InputTokens = usage.PromptTokens
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	usage.PromptTokensDetails.CachedTokens = 0
	usage.PromptTokensDetails.CachedCreationTokens = 0
	usage.ClaudeCacheCreation5mTokens = 0
	usage.ClaudeCacheCreation1hTokens = 0
}

/**
 * RewriteClaudeResponseUsageBytes 重写 Claude 响应 JSON 中的 usage 字段，使缓存字段归零并合并到 input_tokens。
 * 用于非流式 Claude 透传响应。
 * @param {[]byte} data - 原始响应 JSON
 * @returns {[]byte} 重写后的 JSON；解析失败时回退原始数据
 */
func RewriteClaudeResponseUsageBytes(data []byte) []byte {
	if len(data) == 0 {
		return data
	}
	usagePath := "usage"
	if !gjson.GetBytes(data, usagePath).Exists() {
		return data
	}
	return []byte(rewriteUsageInString(string(data), usagePath))
}

/**
 * RewriteClaudeStreamUsageString 重写流式 SSE 单事件 JSON 中的 usage 字段。
 * 同时处理 message_start 事件中嵌套的 message.usage 路径。
 * @param {string} data - 单条 SSE 事件 JSON 字符串
 * @returns {string} 重写后的字符串；解析失败时回退原始数据
 */
func RewriteClaudeStreamUsageString(data string) string {
	if data == "" {
		return data
	}
	if gjson.Get(data, "usage").Exists() {
		data = rewriteUsageInString(data, "usage")
	}
	if gjson.Get(data, "message.usage").Exists() {
		data = rewriteUsageInString(data, "message.usage")
	}
	return data
}

/**
 * rewriteUsageInString 将给定 usage 路径下的缓存字段归零并折算回 input_tokens。
 */
func rewriteUsageInString(data string, usagePath string) string {
	usage := gjson.Get(data, usagePath)
	if !usage.Exists() {
		return data
	}
	inputTokens := usage.Get("input_tokens").Int()
	cacheCreation := usage.Get("cache_creation_input_tokens").Int()
	cacheRead := usage.Get("cache_read_input_tokens").Int()
	newInput := inputTokens + cacheCreation + cacheRead

	if patched, err := sjson.Set(data, usagePath+".input_tokens", newInput); err == nil {
		data = patched
	}
	if patched, err := sjson.Set(data, usagePath+".cache_creation_input_tokens", 0); err == nil {
		data = patched
	}
	if patched, err := sjson.Set(data, usagePath+".cache_read_input_tokens", 0); err == nil {
		data = patched
	}
	if usage.Get("cache_creation").Exists() {
		if patched, err := sjson.Set(data, usagePath+".cache_creation.ephemeral_5m_input_tokens", 0); err == nil {
			data = patched
		}
		if patched, err := sjson.Set(data, usagePath+".cache_creation.ephemeral_1h_input_tokens", 0); err == nil {
			data = patched
		}
	}
	return data
}
