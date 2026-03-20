import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Breadcrumbs } from './Breadcrumbs'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { IdleWarningDialog } from '@/components/common/IdleWarningDialog'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  useKeyboardShortcuts()
  const { orgId } = useAuthStore()
  const loadOrg = useOrgStore((s) => s.load)
  const { showWarning, secondsLeft, dismissWarning } = useIdleTimeout()
  const location = useLocation()
  const [focusKey, setFocusKey] = useState(0)

  // Re-mount page content when the browser tab becomes visible again
  // This ensures useState/useEffect-based pages reload their data
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      setFocusKey(k => k + 1)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [handleVisibilityChange])

  useEffect(() => {
    if (orgId) loadOrg(orgId)
  }, [orgId, loadOrg])
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main key={`${location.pathname}:${focusKey}`} className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
      <IdleWarningDialog
        open={showWarning}
        secondsLeft={secondsLeft}
        onStayLoggedIn={dismissWarning}
      />
    </div>
  )
}
