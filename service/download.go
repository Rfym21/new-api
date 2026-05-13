package service

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// DoDownloadRequest 直接发起下载请求；做 SSRF 防护与日志埋点。
// 历史上曾支持通过 Cloudflare Worker 反代，已移除该路径，仅保留直连。
func DoDownloadRequest(originUrl string, reason ...string) (resp *http.Response, err error) {
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		originUrl,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}

	common.SysLog(fmt.Sprintf("downloading from origin: %s, reason: %s",
		common.MaskSensitiveInfo(originUrl), strings.Join(reason, ", ")))
	return GetHttpClient().Get(originUrl)
}
