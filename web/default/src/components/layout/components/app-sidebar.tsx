import { useMemo } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { useLayout } from '@/context/layout-provider'
import { useSidebarConfig } from '@/hooks/use-sidebar-config'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getLucideIcon } from '@/lib/lucide-icon'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getNavGroupsForPath } from '../lib/workspace-registry'
import type { NavGroup as NavGroupType, NavLink } from '../types'
import { NavGroup } from './nav-group'
import { WorkspaceSwitcher } from './workspace-switcher'

/**
 * Application sidebar component
 * Fetches corresponding navigation menu from workspace registry based on current path
 * Dynamically filters navigation items based on backend SidebarModulesAdmin configuration
 *
 * Automatically matches workspace configuration for current path through workspace registry system
 * Adding new workspaces only requires registration in workspace-registry.ts
 */
export function AppSidebar() {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()
  const { pathname } = useLocation()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const sidebarData = useSidebarData()
  const { sidebarCustomItems } = useSystemConfig()

  // Get navigation group configuration corresponding to current path from workspace registry
  const allNavGroups = getNavGroupsForPath(pathname, t) || sidebarData.navGroups

  // Filter sidebar navigation items based on backend configuration
  const configFilteredNavGroups = useSidebarConfig(allNavGroups)

  // Filter navigation groups based on user role
  // Non-Admin users cannot see Admin navigation group
  const currentNavGroups = useMemo(() => {
    const isAdmin = userRole && userRole >= ROLE.ADMIN
    return configFilteredNavGroups.filter((group) => {
      if (group.id === 'admin') {
        return isAdmin
      }
      return true
    })
  }, [configFilteredNavGroups, userRole])

  // 管理员配置的自定义导航项追加到末尾，按 group 字段聚合
  const customNavGroups = useMemo<NavGroupType[]>(() => {
    if (!sidebarCustomItems || sidebarCustomItems.length === 0) return []
    const buckets = new Map<string, NavLink[]>()
    sidebarCustomItems.forEach((item) => {
      const groupTitle = (item.group && item.group.trim()) || t('Custom')
      const list = buckets.get(groupTitle) ?? []
      list.push({
        title: item.title,
        url: item.url,
        icon: getLucideIcon(item.icon),
      })
      buckets.set(groupTitle, list)
    })
    return Array.from(buckets.entries()).map(([title, items]) => ({
      id: `custom-${title}`,
      title,
      items,
    }))
  }, [sidebarCustomItems, t])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <WorkspaceSwitcher workspaces={sidebarData.workspaces} />
      </SidebarHeader>
      <SidebarContent>
        {currentNavGroups.map((props) => {
          const key = props.id || props.title
          return <NavGroup key={key} {...props} />
        })}
        {customNavGroups.map((props) => (
          <NavGroup key={props.id} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
