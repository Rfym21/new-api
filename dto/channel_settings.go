package dto

import "strings"

type ChannelSettings struct {
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
	AzureResponsesVersion string        `json:"azure_responses_version,omitempty"`
	VertexKeyType         VertexKeyType `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise  *bool         `json:"openrouter_enterprise,omitempty"`
	ClaudeBetaQuery       bool          `json:"claude_beta_query,omitempty"` // Claude 渠道是否强制追加 ?beta=true
	AwsKeyType            AwsKeyType    `json:"aws_key_type,omitempty"`

	// BodyFieldPassThrough 渠道级请求体字段透传白名单。
	// 若字段对应 Enabled=true，则跳过默认过滤；否则按默认策略处理。
	// 字段名支持 a.b.c 形式表示嵌套对象路径。
	BodyFieldPassThrough []FieldPassThroughRule `json:"body_field_pass_through,omitempty"`
	// HeaderFieldPassThrough 渠道级请求头透传白名单。
	HeaderFieldPassThrough []FieldPassThroughRule `json:"header_field_pass_through,omitempty"`
}

// FieldPassThroughRule 字段透传规则。
// 用于渠道级显式声明哪些请求体/头字段允许或禁止透传给上游。
type FieldPassThroughRule struct {
	Field   string `json:"field"`             // 字段名（请求体支持 a.b.c 嵌套路径）
	Enabled bool   `json:"enabled"`           // 是否允许透传
	Comment string `json:"comment,omitempty"` // 备注，仅作 UI 展示
}

// IsBodyFieldAllowed 返回某请求体字段是否被显式允许透传；未在规则中声明返回 false。
func (s *ChannelOtherSettings) IsBodyFieldAllowed(field string) bool {
	if s == nil {
		return false
	}
	for _, rule := range s.BodyFieldPassThrough {
		if rule.Field == field {
			return rule.Enabled
		}
	}
	return false
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
