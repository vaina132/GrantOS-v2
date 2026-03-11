import { Menu, LogOut, ChevronDown, ChevronLeft, ChevronRight, Sun, Moon, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import { getYearOptions, cn } from '@/lib/utils'
import { differenceInDays } from 'date-fns'
import { NotificationBell } from '@/components/layout/NotificationBell'

export function TopBar() {
  const navigate = useNavigate()
  const { user, role, accessType, orgPlan, trialEndsAt, signOut } = useAuthStore()
  const { globalYear, setGlobalYear, toggleSidebar, darkMode, toggleDarkMode } = useUiStore()

  const yearOptions = getYearOptions()
  const userEmail = user?.email ?? ''
  const initials = userEmail.slice(0, 2).toUpperCase()

  const trialDaysLeft =
    orgPlan === 'trial' && trialEndsAt
      ? Math.max(0, differenceInDays(new Date(trialEndsAt), new Date()))
      : null

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {trialDaysLeft !== null && (
        <div className="hidden items-center gap-2 rounded-md bg-amber-50 px-3 py-1 text-sm text-amber-800 sm:flex">
          <span>Trial: {trialDaysLeft} days remaining</span>
        </div>
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setGlobalYear(globalYear - 1)}
            disabled={globalYear <= yearOptions[0]}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
            {yearOptions.filter(y => Math.abs(y - globalYear) <= 2).map((year) => (
              <button
                key={year}
                onClick={() => setGlobalYear(year)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-all',
                  year === globalYear
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {year}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setGlobalYear(globalYear + 1)}
            disabled={globalYear >= yearOptions[yearOptions.length - 1]}
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

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
                  {accessType === 'guest' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Guest
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
                  {role ?? 'Guest'}{accessType === 'guest' ? ' (External)' : ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <Settings className="mr-2 h-4 w-4" />
              My Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
