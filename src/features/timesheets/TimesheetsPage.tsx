import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MyTimesheet } from './MyTimesheet'
import { AllTimesheets } from './AllTimesheets'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

type Tab = 'my' | 'all'

export function TimesheetsPage() {
  const { can } = useAuthStore()
  const isManager = can('canManageAllocations')
  const [tab, setTab] = useState<Tab>(isManager ? 'all' : 'my')

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'my', label: 'Enter Timesheet', show: true },
    { key: 'all', label: 'Review & Approve', show: isManager },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title="Timesheets"
        description="Record actual hours worked per project and submit for approval"
      />

      <div className="border-b mt-4">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          {tabs.filter((t) => t.show).map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'whitespace-nowrap pb-3 pt-1 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="pt-5">
        {tab === 'my' && <MyTimesheet />}
        {tab === 'all' && isManager && <AllTimesheets />}
      </div>
    </div>
  )
}
