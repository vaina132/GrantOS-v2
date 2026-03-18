import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  FolderKanban,
  Lightbulb,
  Globe,
  Users,
  CalendarDays,
  ClipboardCheck,
  CalendarOff,
  DollarSign,
  GanttChart,
  FileText,
  Shield,
  Settings,
  HelpCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'
import type { PermissionKey } from '@/lib/permissions'
import type { LucideIcon } from 'lucide-react'
import { AiQuotaWidget } from '@/components/ai/AiQuotaWidget'

interface NavItem {
  path: string
  labelKey: string
  icon: LucideIcon
  permission?: PermissionKey
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.core',
    items: [
      { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'canSeeDashboard' },
      { path: '/staff', labelKey: 'nav.staff', icon: Users, permission: 'canSeeStaff' },
      { path: '/proposals', labelKey: 'nav.proposals', icon: Lightbulb, permission: 'canSeeProposals' },
      { path: '/projects', labelKey: 'nav.projects', icon: FolderKanban, permission: 'canSeeProjects' },
      { path: '/projects/collaboration', labelKey: 'nav.collaboration', icon: Globe, permission: 'canSeeCollaboration' },
    ],
  },
  {
    labelKey: 'nav.operations',
    items: [
      { path: '/allocations', labelKey: 'nav.allocations', icon: CalendarDays, permission: 'canSeeAllocations' },
      { path: '/timesheets', labelKey: 'nav.timesheets', icon: ClipboardCheck, permission: 'canSeeTimesheets' },
      { path: '/absences', labelKey: 'nav.absences', icon: CalendarOff, permission: 'canSeeAbsences' },
      { path: '/financials', labelKey: 'nav.financials', icon: DollarSign, permission: 'canSeeFinancials' },
      { path: '/timeline', labelKey: 'nav.timeline', icon: GanttChart, permission: 'canSeeTimeline' },
    ],
  },
  {
    labelKey: 'nav.administration',
    items: [
      { path: '/reports', labelKey: 'nav.reports', icon: FileText, permission: 'canSeeReports' },
      { path: '/audit', labelKey: 'nav.auditLog', icon: Shield, permission: 'canSeeAudit' },
      { path: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'canManageOrg' },
    ],
  },
]

export function Sidebar() {
  const { can, orgName } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const location = useLocation()
  const { t } = useTranslation()

  const visibleGroups = NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.permission) return true
        return can(item.permission)
      }),
    })).filter((group) => group.items.length > 0)

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-background transition-transform lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2 min-w-0">
            <GrantLumeLogo size={30} variant="color" className="shrink-0" />
            <div className="min-w-0">
              <span className="text-lg font-semibold leading-tight block"><span className="text-[#1a2744] dark:text-white">Grant</span><span className="text-emerald-600">Lume</span></span>
              {orgName && (
                <span className="text-xs text-muted-foreground truncate block">{orgName}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {visibleGroups.map((group, gi) => (
            <div key={group.labelKey || gi} className={cn(gi > 0 && 'mt-5')}>
              {group.labelKey && (
                <div className="mb-1 px-3 pt-1 pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {t(group.labelKey)}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  // Check if a more specific sibling path matches — if so, this item should not be active
                  const hasMoreSpecificMatch = group.items.some(
                    (other) => other.path !== item.path && other.path.startsWith(item.path + '/') &&
                    (location.pathname === other.path || location.pathname.startsWith(other.path + '/'))
                  )
                  const isActive = !hasMoreSpecificMatch && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-accent-foreground')} />
                      {t(item.labelKey)}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-3 py-3 space-y-2">
          {can('canSeeDashboard') && <AiQuotaWidget variant="compact" className="px-3 py-1" />}
          <NavLink
            to="/help"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              location.pathname === '/help'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <HelpCircle className={cn('h-4.5 w-4.5 shrink-0', location.pathname === '/help' ? 'text-primary' : 'text-muted-foreground/70')} />
            {t('nav.help')}
          </NavLink>
          <p className="text-xs text-muted-foreground text-center">GrantLume v2.0</p>
        </div>
      </aside>
    </>
  )
}
