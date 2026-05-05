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

// ThemeAssets holds the embedded frontend assets for both themes.
type ThemeAssets struct {
	DefaultBuildFS   embed.FS
	DefaultIndexPage []byte
	ClassicBuildFS   embed.FS
	ClassicIndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(webRateLimitSkipAssets())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", themeFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		if common.GetTheme() == "classic" {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.ClassicIndexPage)
		} else {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.DefaultIndexPage)
		}
	})
}

// webRateLimitSkipAssets wraps GlobalWebRateLimit so that frontend static
// assets (JS chunks, CSS, fonts, images) bypass the limiter. The v1.0 default
// frontend code-splits aggressively and a single page load can fan out to
// dozens of chunk requests, easily exceeding the default 60 req / 180 sec
// budget that's intended for user-facing actions, not asset fetches.
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
