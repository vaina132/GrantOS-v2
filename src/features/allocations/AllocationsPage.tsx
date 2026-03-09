import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { AllocationGrid } from './AllocationGrid'
import { PmBudgets } from './PmBudgets'
import { PeriodLocking } from './PeriodLocking'
import { AssignmentMatrix } from '../matrix/AssignmentMatrix'
import { ProjectMatrix } from './ProjectMatrix'
import { allocationsService } from '@/services/allocationsService'
import { useAssignments } from '@/hooks/useAllocations'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { toast } from '@/components/ui/use-toast'
import { ArrowRightCircle, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssignmentType } from '@/types'

type Tab = 'grid' | 'matrix-personnel' | 'matrix-projects' | 'budgets' | 'locks'

export function AllocationsPage() {
  const { orgId, can } = useAuthStore()
  const { globalYear } = useUiStore()
  const [mode, setMode] = useState<AssignmentType>('actual')
  const [compareMode, setCompareMode] = useState(false)
  const [tab, setTab] = useState<Tab>('grid')
  const [makingOfficial, setMakingOfficial] = useState(false)
  const { assignments: actualAssignments } = useAssignments('actual')
  const { refetch: refetchOfficial } = useAssignments('official')

  const handleMakeOfficial = async () => {
    if (!orgId) return
    const count = actualAssignments.length
    if (count === 0) {
      toast({ title: 'Nothing to copy', description: 'There are no actual allocations for the current year.' })
      return
    }
    const proceed = window.confirm(
      `This will copy all ${count} actual allocation entries for ${globalYear} into Official.\n\nExisting official entries for the same person-project-month will be overwritten.\n\nContinue?`
    )
    if (!proceed) return

    setMakingOfficial(true)
    try {
      let copied = 0
      for (const a of actualAssignments) {
        await allocationsService.upsertAssignment({
          org_id: orgId,
          person_id: a.person_id,
          project_id: a.project_id,
          work_package_id: a.work_package_id,
          year: a.year,
          month: a.month,
          pms: a.pms,
          type: 'official',
        })
        copied++
      }
      toast({ title: 'Done', description: `${copied} entries copied to Official.` })
      refetchOfficial()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to make official'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setMakingOfficial(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'grid', label: 'Allocation Grid' },
    { key: 'matrix-personnel', label: 'Personnel Overview' },
    { key: 'matrix-projects', label: 'Project Overview' },
    { key: 'budgets', label: 'PM Budgets' },
    { key: 'locks', label: 'Period Locks' },
  ]

  const showModeSelector = tab === 'grid' || tab === 'matrix-personnel' || tab === 'matrix-projects'

  return (
    <div className="space-y-0">
      <PageHeader
        title="Allocations"
        description="Manage person-month allocations across projects"
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

      {/* ── Contextual toolbar (only for views that have Actual / Official) ── */}
      {showModeSelector && (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-5 pb-1">
          {/* Left: mode toggle pill */}
          <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
            <button
              onClick={() => { setMode('actual'); setCompareMode(false) }}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
                mode === 'actual' && !compareMode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Actual
            </button>
            <button
              onClick={() => { setMode('official'); setCompareMode(false) }}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
                mode === 'official' && !compareMode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Official
            </button>
            {tab === 'grid' && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5',
                  compareMode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare
              </button>
            )}
          </div>

          {/* Right: actions */}
          {tab === 'grid' && mode === 'actual' && !compareMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMakeOfficial}
              disabled={makingOfficial}
              className="gap-1.5"
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
              {makingOfficial ? 'Copying...' : 'Make Official'}
            </Button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <div className={cn(!showModeSelector && 'pt-5', 'animate-fade-in')} key={`${tab}-${mode}-${compareMode}`}>
        {tab === 'grid' && <AllocationGrid mode={mode} compareMode={compareMode} />}
        {tab === 'matrix-personnel' && <AssignmentMatrix type={mode} />}
        {tab === 'matrix-projects' && <ProjectMatrix type={mode} />}
        {tab === 'budgets' && <PmBudgets type={mode} />}
        {tab === 'locks' && can('canManageOrg') && <PeriodLocking />}
      </div>
    </div>
  )
}
