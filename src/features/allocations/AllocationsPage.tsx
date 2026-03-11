import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { YearSelector } from '@/components/common/YearSelector'
import { AllocationGrid } from './AllocationGrid'
import { PmBudgets } from './PmBudgets'
import { PeriodLocking } from './PeriodLocking'
import { AssignmentMatrix } from '../matrix/AssignmentMatrix'
import { ProjectMatrix } from './ProjectMatrix'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

type Tab = 'grid' | 'matrix-personnel' | 'matrix-projects' | 'budgets' | 'locks'

export function AllocationsPage() {
  const { can } = useAuthStore()
  const [tab, setTab] = useState<Tab>('grid')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'grid', label: 'Allocation Grid' },
    { key: 'matrix-personnel', label: 'Personnel Overview' },
    { key: 'matrix-projects', label: 'Project Overview' },
    { key: 'budgets', label: 'PM Budgets' },
    { key: 'locks', label: 'Period Locks' },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title="Allocations"
        description="Manage person-month allocations across projects"
        actions={<YearSelector />}
      />

      {/* ── Navigation tabs ── */}
      <div className="border-b mt-4">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((t) => {
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

      {/* ── Content ── */}
      <div className="pt-5 animate-fade-in" key={tab}>
        {tab === 'grid' && <AllocationGrid />}
        {tab === 'matrix-personnel' && <AssignmentMatrix />}
        {tab === 'matrix-projects' && <ProjectMatrix />}
        {tab === 'budgets' && <PmBudgets />}
        {tab === 'locks' && can('canManageOrg') && <PeriodLocking />}
      </div>
    </div>
  )
}
