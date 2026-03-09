import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
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
import type { PermissionKey } from '@/lib/permissions'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  permission?: PermissionKey
  guestAllowed?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/staff', label: 'Staff', icon: Users },
  { path: '/allocations', label: 'Allocations', icon: CalendarDays, permission: 'canManageAllocations' },
  { path: '/timesheets', label: 'Timesheets', icon: ClipboardCheck, permission: 'canSubmitTimesheets', guestAllowed: true },
  { path: '/absences', label: 'Absences', icon: CalendarOff, permission: 'canManageAllocations' },
  { path: '/financials', label: 'Financials', icon: DollarSign, permission: 'canSeeFinancials' },
  { path: '/timeline', label: 'Project Timeline', icon: GanttChart },
  { path: '/reports', label: 'Reports', icon: FileText, permission: 'canGenerateReports' },
  { path: '/import', label: 'Import', icon: Upload, permission: 'canManageOrg' },
  { path: '/audit', label: 'Audit Log', icon: Shield, permission: 'canSeeFinancials' },
  { path: '/guests', label: 'Guest Access', icon: UserCheck, permission: 'canManageOrg' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'canManageOrg' },
]

const GUEST_NAV_ITEMS: NavItem[] = [
  { path: '/projects', label: 'Project Overview', icon: FolderKanban },
  { path: '/timesheets', label: 'Timesheets', icon: ClipboardCheck, guestAllowed: true },
]

export function Sidebar() {
  const { can, accessType, orgName } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUiStore()
  const location = useLocation()

  const items = accessType === 'guest' ? GUEST_NAV_ITEMS : NAV_ITEMS

  const visibleItems = items.filter((item) => {
    if (!item.permission) return true
    return can(item.permission)
  })

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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              G
            </div>
            <div className="min-w-0">
              <span className="text-lg font-semibold leading-tight block">GrantOS</span>
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

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">GrantOS v2.0</p>
        </div>
      </aside>
    </>
  )
}
