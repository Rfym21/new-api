package dto

import "strings"

type ChannelSettings struct {
	ForceFormat            bool   `json:"force_format,omitempty"`
	ThinkingToContent      bool   `json:"thinking_to_content,omitempty"`
	Proxy                  string `json:"proxy"`
	PassThroughBodyEnabled bool   `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool   `json:"system_prompt_override,omitempty"`

	// 屏蔽词过滤（渠道级）
	// SensitiveCheckEnabled 渠道级开关：nil 沿用全局，*true 强制启用，*false 强制禁用
	SensitiveCheckEnabled *bool `json:"sensitive_check_enabled,omitempty"`
	// SensitiveMode 词表作用模式：空或 "inherit" 沿用全局；"modify" 在全局基础上增减；"override" 仅用此处配置
	SensitiveMode string `json:"sensitive_mode,omitempty"`
	// SensitiveAddedWords modify 模式下在全局基础上新增的屏蔽词
	SensitiveAddedWords []string `json:"sensitive_added_words,omitempty"`
	// SensitiveRemovedWords modify 模式下从全局排除的屏蔽词（归一化后比较）
	SensitiveRemovedWords []string `json:"sensitive_removed_words,omitempty"`
	// SensitiveOverrideWords override 模式下作为唯一来源的屏蔽词
	SensitiveOverrideWords []string `json:"sensitive_override_words,omitempty"`

	// 空回复不计费（渠道级）
	// EmptyResponseNoBillingEnabled 渠道级开关：nil 沿用全局，*true 强制启用不计费，*false 强制禁用（照常计费）
	EmptyResponseNoBillingEnabled *bool `json:"empty_response_no_billing_enabled,omitempty"`
}

// ShouldCheckSensitive 渠道级与全局开关的合成结果。
// SensitiveCheckEnabled 为 nil 时沿用 globalEnabled；显式 true/false 则强制生效。
func (s ChannelSettings) ShouldCheckSensitive(globalEnabled bool) bool {
	if s.SensitiveCheckEnabled == nil {
		return globalEnabled
	}
	return *s.SensitiveCheckEnabled
}

// ShouldSkipEmptyResponseBilling 渠道级与全局开关的合成结果。
// EmptyResponseNoBillingEnabled 为 nil 时沿用 globalEnabled；显式 true/false 则强制生效。
func (s ChannelSettings) ShouldSkipEmptyResponseBilling(globalEnabled bool) bool {
	if s.EmptyResponseNoBillingEnabled == nil {
		return globalEnabled
	}
	return *s.EmptyResponseNoBillingEnabled
}

// EffectiveSensitiveWords 根据 SensitiveMode 合并全局词表与渠道配置，返回此渠道实际生效的词表。
// 归一化策略（lower + trim）与 AcSearch 行为一致。
// 注意：inherit 分支直接返回入参 global 切片，调用方不得修改返回值。
func (s ChannelSettings) EffectiveSensitiveWords(global []string) []string {
	switch s.SensitiveMode {
	case "override":
		return dedupNormalizedWords(s.SensitiveOverrideWords)
	case "modify":
		set := make(map[string]struct{}, len(global)+len(s.SensitiveAddedWords))
		for _, w := range global {
			if k := normalizeWord(w); k != "" {
				set[k] = struct{}{}
			}
		}
		for _, w := range s.SensitiveRemovedWords {
			if k := normalizeWord(w); k != "" {
				delete(set, k)
			}
		}
		for _, w := range s.SensitiveAddedWords {
			if k := normalizeWord(w); k != "" {
				set[k] = struct{}{}
			}
		}
		out := make([]string, 0, len(set))
		for w := range set {
			out = append(out, w)
		}
		return out
	default:
		return global
	}
}

func normalizeWord(w string) string {
	return strings.ToLower(strings.TrimSpace(w))
}

func dedupNormalizedWords(words []string) []string {
	if len(words) == 0 {
		return nil
	}
	set := make(map[string]struct{}, len(words))
	for _, w := range words {
		if k := normalizeWord(w); k != "" {
			set[k] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for w := range set {
		out = append(out, w)
	}
	return out
}

type VertexKeyType string

const (
	VertexKeyTypeJSON   VertexKeyType = "json"
	VertexKeyTypeAPIKey VertexKeyType = "api_key"
)

type AwsKeyType string

const (
	AwsKeyTypeAKSK   AwsKeyType = "ak_sk" // 默认
	AwsKeyTypeApiKey AwsKeyType = "api_key"
)

type ChannelOtherSettings struct {
	AzureResponsesVersion                 string        `json:"azure_responses_version,omitempty"`
	VertexKeyType                         VertexKeyType `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise                  *bool         `json:"openrouter_enterprise,omitempty"`
	ClaudeBetaQuery                       bool          `json:"claude_beta_query,omitempty"`         // Claude 渠道是否强制追加 ?beta=true
	AllowServiceTier                      bool          `json:"allow_service_tier,omitempty"`        // 是否允许 service_tier 透传（默认过滤以避免额外计费）
	AllowInferenceGeo                     bool          `json:"allow_inference_geo,omitempty"`       // 是否允许 inference_geo 透传（仅 Claude，默认过滤以满足数据驻留合规
	AllowSpeed                            bool          `json:"allow_speed,omitempty"`               // 是否允许 speed 透传（仅 Claude，默认过滤以避免意外切换推理速度模式）
	AllowSafetyIdentifier                 bool          `json:"allow_safety_identifier,omitempty"`   // 是否允许 safety_identifier 透传（默认过滤以保护用户隐私）
	DisableStore                          bool          `json:"disable_store,omitempty"`             // 是否禁用 store 透传（默认允许透传，禁用后可能导致 Codex 无法使用）
	AllowIncludeObfuscation               bool          `json:"allow_include_obfuscation,omitempty"` // 是否允许 stream_options.include_obfuscation 透传（默认过滤以避免关闭流混淆保护）
	AwsKeyType                            AwsKeyType    `json:"aws_key_type,omitempty"`
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
