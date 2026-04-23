import { Menu, LogOut, ChevronDown, Sun, Moon, Settings, PanelLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { differenceInDays } from 'date-fns'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Crown } from 'lucide-react'

export function TopBar() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, role, orgPlan, trialEndsAt, signOut } = useAuthStore()
  const { toggleSidebar, sidebarOpen, darkMode, toggleDarkMode } = useUiStore()
  const userEmail = user?.email ?? ''
  const initials = userEmail.slice(0, 2).toUpperCase()

  const trialDaysLeft =
    orgPlan === 'trial' && trialEndsAt
      ? Math.max(0, differenceInDays(new Date(trialEndsAt), new Date()))
      : null

  const isFree = orgPlan === 'free'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
        title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <Menu className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
      </Button>

      {trialDaysLeft !== null && (
        <div className="hidden items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-sm text-amber-800 dark:text-amber-300 sm:flex">
          <span>{t('topbar.trialDaysRemaining', { days: trialDaysLeft })}</span>
        </div>
      )}

      {isFree && (
        <button
          onClick={() => navigate('/settings?tab=subscription')}
          className="hidden items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1 text-sm text-amber-800 dark:text-amber-300 sm:flex hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer"
        >
          <Crown className="h-3.5 w-3.5" />
          <span>Free plan — Upgrade to Pro</span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleDarkMode}
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left md:flex">
                <span className="text-sm font-medium">{userEmail}</span>
                <div className="flex items-center gap-1">
                  {role && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {role}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{userEmail}</p>
                <p className="text-xs text-muted-foreground">
                  {role ?? 'Member'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <Settings className="mr-2 h-4 w-4" />
              {t('topbar.mySettings')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t('topbar.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
