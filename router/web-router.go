package router

import (
	"embed"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// FrontendAssets holds the embedded classic frontend assets.
type FrontendAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets FrontendAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(webRateLimitSkipAssets())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}

// webRateLimitSkipAssets wraps GlobalWebRateLimit so that frontend static
// assets (JS chunks, CSS, fonts, images) bypass the limiter.
func webRateLimitSkipAssets() gin.HandlerFunc {
	inner := middleware.GlobalWebRateLimit()
	return func(c *gin.Context) {
		if isFrontendAssetPath(c.Request.URL.Path) {
			c.Next()
			return
		}
		inner(c)
	}
}

func isFrontendAssetPath(p string) bool {
	if strings.HasPrefix(p, "/static/") ||
		strings.HasPrefix(p, "/assets/") ||
		strings.HasPrefix(p, "/avatars/") {
		return true
	}
	switch path.Ext(p) {
	case ".js", ".mjs", ".css", ".map",
		".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
		".woff", ".woff2", ".ttf", ".otf", ".eot":
		return true
	}
	return false
}
