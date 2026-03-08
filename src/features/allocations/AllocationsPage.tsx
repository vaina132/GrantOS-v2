import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { AllocationGrid } from './AllocationGrid'
import { PmBudgets } from './PmBudgets'
import { PeriodLocking } from './PeriodLocking'
import { useAuthStore } from '@/stores/authStore'
import type { AssignmentType } from '@/types'

type Tab = 'grid' | 'budgets' | 'locks'

export function AllocationsPage() {
  const { can } = useAuthStore()
  const [mode, setMode] = useState<AssignmentType>('actual')
  const [compareMode, setCompareMode] = useState(false)
  const [tab, setTab] = useState<Tab>('grid')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        description="Manage person-month allocations across projects"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(['grid', 'budgets', 'locks'] as Tab[]).map((t) => (
            <Button
              key={t}
              variant={tab === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t)}
            >
              {t === 'grid' ? 'Allocation Grid' : t === 'budgets' ? 'PM Budgets' : 'Period Locks'}
            </Button>
          ))}
        </div>

        {tab === 'grid' && (
          <div className="flex gap-2">
            <Button
              variant={mode === 'actual' && !compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMode('actual'); setCompareMode(false) }}
            >
              Actual
            </Button>
            <Button
              variant={mode === 'official' && !compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMode('official'); setCompareMode(false) }}
            >
              Official
            </Button>
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
            >
              Compare
            </Button>
          </div>
        )}
      </div>

      {tab === 'grid' && <AllocationGrid mode={mode} compareMode={compareMode} />}
      {tab === 'budgets' && <PmBudgets type={mode} />}
      {tab === 'locks' && can('canManageOrg') && <PeriodLocking />}
    </div>
  )
}
