import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_REGISTRY = LucideIcons as unknown as Record<string, LucideIcon>

const FALLBACK: LucideIcon = LucideIcons.Link

/**
 * 按名字解析 lucide-react 图标组件。找不到时回退到 Link 图标。
 * 名字大小写敏感，与 lucide-react 导出的 PascalCase 一致（例如 "Github"、"BookOpen"）。
 */
export function getLucideIcon(name?: string | null): LucideIcon {
  if (!name) return FALLBACK
  const found = ICON_REGISTRY[name]
  return typeof found === 'function' ? found : FALLBACK
}

/**
 * 全部可选 lucide 图标名（PascalCase）。用于图标选择器穷举展示。
 */
export function listLucideIconNames(): string[] {
  return Object.keys(ICON_REGISTRY)
    .filter((name) => /^[A-Z]/.test(name))
    .filter((name) => typeof ICON_REGISTRY[name] === 'function')
    .sort()
}
