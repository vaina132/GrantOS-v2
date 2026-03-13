import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  FolderKanban,
  Lightbulb,
  Users,
  CalendarDays,
  ClipboardCheck,
  CalendarOff,
  DollarSign,
  GanttChart,
  FileText,
  Upload,
  Shield,
  UserCheck,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'
import type { PermissionKey } from '@/lib/permissions'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  path: string
  labelKey: string
  icon: LucideIcon
  permission?: PermissionKey
  guestAllowed?: boolean
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.core',
    items: [
      { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { path: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
      { path: '/proposals', labelKey: 'nav.proposals', icon: Lightbulb, permission: 'canSeeProposals' },
      { path: '/staff', labelKey: 'nav.staff', icon: Users },
    ],
  },
  {
    labelKey: 'nav.operations',
    items: [
      { path: '/allocations', labelKey: 'nav.allocations', icon: CalendarDays, permission: 'canSeeAllocations' },
      { path: '/timesheets', labelKey: 'nav.timesheets', icon: ClipboardCheck, permission: 'canSeeTimesheets', guestAllowed: true },
      { path: '/absences', labelKey: 'nav.absences', icon: CalendarOff, permission: 'canSeeAbsences' },
      { path: '/financials', labelKey: 'nav.financials', icon: DollarSign, permission: 'canSeeFinancials' },
      { path: '/timeline', labelKey: 'nav.timeline', icon: GanttChart, permission: 'canSeeTimeline' },
    ],
  },
  {
    labelKey: 'nav.administration',
    items: [
      { path: '/reports', labelKey: 'nav.reports', icon: FileText, permission: 'canSeeReports' },
      { path: '/import', labelKey: 'nav.import', icon: Upload, permission: 'canSeeImport' },
      { path: '/audit', labelKey: 'nav.auditLog', icon: Shield, permission: 'canSeeAudit' },
      { path: '/guests', labelKey: 'nav.guestAccess', icon: UserCheck, permission: 'canSeeGuests' },
      { path: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'canManageOrg' },
    ],
  },
]

const GUEST_NAV_ITEMS: NavItem[] = [
  { path: '/projects', labelKey: 'nav.projectOverview', icon: FolderKanban },
  { path: '/timesheets', labelKey: 'nav.timesheets', icon: ClipboardCheck, guestAllowed: true },
]

export function Sidebar() {
  const { can, accessType, orgName } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const location = useLocation()
  const { t } = useTranslation()

  const visibleGroups = accessType === 'guest'
    ? [{ labelKey: '', items: GUEST_NAV_ITEMS }]
    : NAV_GROUPS.map((group) => ({
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
                  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
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

        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">GrantLume v2.0</p>
        </div>
      </aside>
    </>
  )
}
