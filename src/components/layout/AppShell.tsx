import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Breadcrumbs } from './Breadcrumbs'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  useKeyboardShortcuts()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  )
}
