import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Users, FolderKanban, CalendarDays, Lock, BarChart3, ArrowRightCircle } from 'lucide-react'
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

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'grid', label: 'Allocation Grid', icon: CalendarDays },
    { key: 'matrix-personnel', label: 'Matrix (Personnel)', icon: Users },
    { key: 'matrix-projects', label: 'Matrix (Projects)', icon: FolderKanban },
    { key: 'budgets', label: 'PM Budgets', icon: BarChart3 },
    { key: 'locks', label: 'Period Locks', icon: Lock },
  ]

  const showModeSelector = tab === 'grid' || tab === 'matrix-personnel' || tab === 'matrix-projects'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        description="Manage person-month allocations across projects"
      />

      {/* Tab bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 flex-wrap">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <Button
                key={t.key}
                variant={tab === t.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab(t.key)}
                className="gap-1.5"
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Button>
            )
          })}
        </div>

        {showModeSelector && (
          <div className="flex gap-2 items-center">
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
            {tab === 'grid' && (
              <Button
                variant={compareMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompareMode(!compareMode)}
              >
                Compare
              </Button>
            )}
            {tab === 'grid' && mode === 'actual' && !compareMode && (
              <>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMakeOfficial}
                  disabled={makingOfficial}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ArrowRightCircle className="h-4 w-4" />
                  {makingOfficial ? 'Copying...' : 'Make Official'}
                </Button>
              </>
            )}
            <Badge variant="secondary" className="text-xs ml-1">
              {mode === 'actual' ? 'Actual' : 'Official'}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'grid' && <AllocationGrid mode={mode} compareMode={compareMode} />}
      {tab === 'matrix-personnel' && <AssignmentMatrix type={mode} />}
      {tab === 'matrix-projects' && <ProjectMatrix type={mode} />}
      {tab === 'budgets' && <PmBudgets type={mode} />}
      {tab === 'locks' && can('canManageOrg') && <PeriodLocking />}
    </div>
  )
}
