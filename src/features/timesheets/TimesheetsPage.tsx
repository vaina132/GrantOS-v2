import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuthStore } from '@/stores/authStore'
import { TimesheetGrid } from './TimesheetGrid'
import { AllTimesheets } from './AllTimesheets'
import { TravelTracker } from './TravelTracker'
import { ApprovalRequests } from './ApprovalRequests'
import { ClipboardCheck, Users, Plane, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type TimesheetTab = 'my' | 'approvals' | 'all' | 'travels'

export function TimesheetsPage() {
  const { can } = useAuthStore()
  const isAdmin = can('canApproveTimesheets') || can('canManageProjects')
  const [tab, setTab] = useState<TimesheetTab>('my')

  const tabs: { id: TimesheetTab; label: string; icon: typeof ClipboardCheck; adminOnly?: boolean }[] = [
    { id: 'my', label: 'My Timesheet', icon: ClipboardCheck },
    { id: 'approvals', label: 'Approval Requests', icon: ShieldCheck, adminOnly: true },
    { id: 'all', label: 'All Timesheets', icon: Users, adminOnly: true },
    { id: 'travels', label: 'Travels', icon: Plane },
  ]

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="space-y-0">
      <PageHeader
        title="Timesheets"
        description="Record actual hours worked per project"
      />

      <div className="pt-5 space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 border-b">
          {visibleTabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {tab === 'my' && <TimesheetGrid />}
        {tab === 'approvals' && <ApprovalRequests />}
        {tab === 'all' && <AllTimesheets />}
        {tab === 'travels' && <TravelTracker />}
      </div>
    </div>
  )
}
