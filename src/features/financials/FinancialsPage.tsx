import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { BudgetVsActuals } from './BudgetVsActuals'
import { EnterActuals } from './EnterActuals'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useProjects } from '@/hooks/useProjects'
import { financialService } from '@/services/financialService'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { RefreshCw, Calculator, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'actuals'

export function FinancialsPage() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { projects } = useProjects()
  const [tab, setTab] = useState<Tab>('overview')
  const [seeding, setSeeding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingExpenses, setSyncingExpenses] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const handleSeed = async () => {
    if (!orgId) return
    setSeeding(true)
    try {
      const result = await financialService.seedFromProjects(orgId, projects, globalYear)
      if (result.created === 0 && result.updated === 0) {
        toast({ title: 'Up to date', description: 'All budget rows already exist and are in sync with project data.' })
      } else {
        const parts: string[] = []
        if (result.created > 0) parts.push(`${result.created} created`)
        if (result.updated > 0) parts.push(`${result.updated} updated`)
        toast({ title: 'Synced', description: `Budget rows: ${parts.join(', ')}.` })
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to seed'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  const handleSyncPersonnel = async () => {
    if (!orgId) return
    setSyncing(true)
    try {
      const count = await financialService.syncPersonnelActuals(orgId, globalYear)
      if (count === 0) {
        toast({ title: 'Up to date', description: 'Personnel actuals already match allocation data.' })
      } else {
        toast({ title: 'Synced', description: `${count} personnel actual(s) updated from allocation data.` })
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncExpenses = async () => {
    if (!orgId) return
    setSyncingExpenses(true)
    try {
      const count = await financialService.syncExpenseActuals(orgId, globalYear)
      if (count === 0) {
        toast({ title: 'Up to date', description: 'Non-personnel actuals already match expense records.' })
      } else {
        toast({ title: 'Synced', description: `${count} budget actual(s) updated from expense records.` })
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync expenses'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSyncingExpenses(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Budget Overview' },
    { key: 'actuals', label: 'Enter Actuals' },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title="Financials"
        description={`Budget vs. actuals tracking for ${globalYear}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', seeding && 'animate-spin')} />
              {seeding ? 'Syncing...' : 'Sync Budgets from Projects'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncPersonnel} disabled={syncing} className="gap-1.5">
              <Calculator className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
              {syncing ? 'Computing...' : 'Compute Personnel Actuals'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncExpenses} disabled={syncingExpenses} className="gap-1.5">
              <Receipt className={cn('h-3.5 w-3.5', syncingExpenses && 'animate-spin')} />
              {syncingExpenses ? 'Syncing...' : 'Sync Expense Actuals'}
            </Button>
          </div>
        }
      />

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

      <div className="pt-5 animate-fade-in" key={`${tab}-${refreshKey}`}>
        {tab === 'overview' && <BudgetVsActuals />}
        {tab === 'actuals' && <EnterActuals />}
      </div>
    </div>
  )
}
