import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { BudgetVsActuals } from './BudgetVsActuals'
import { EnterActuals } from './EnterActuals'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { YearSelector } from '@/components/common/YearSelector'
import { useProjects } from '@/hooks/useProjects'
import { financialService } from '@/services/financialService'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { RefreshCw, Calculator, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'actuals'

export function FinancialsPage() {
  const { t } = useTranslation()
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
        toast({ title: t('common.upToDate'), description: t('financials.budgetRowsUpToDate') })
      } else {
        const parts: string[] = []
        if (result.created > 0) parts.push(`${result.created} ${t('financials.created')}`)
        if (result.updated > 0) parts.push(`${result.updated} ${t('financials.updated')}`)
        toast({ title: t('common.synced'), description: t('financials.budgetRowsSynced', { details: parts.join(', ') }) })
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
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
        toast({ title: t('common.upToDate'), description: t('financials.personnelUpToDate') })
      } else {
        toast({ title: t('common.synced'), description: t('financials.personnelSynced', { count }) })
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
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
        toast({ title: t('common.upToDate'), description: t('financials.expensesUpToDate') })
      } else {
        toast({ title: t('common.synced'), description: t('financials.expensesSynced', { count }) })
      }
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSyncingExpenses(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('financials.budgetOverview') },
    { key: 'actuals', label: t('financials.enterActuals') },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title={t('financials.title')}
        description={t('financials.description', { year: globalYear })}
        actions={
          <div className="flex items-center gap-2">
            <YearSelector />
            <div className="h-6 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', seeding && 'animate-spin')} />
              {seeding ? t('common.syncing') : t('financials.syncBudgets')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncPersonnel} disabled={syncing} className="gap-1.5">
              <Calculator className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
              {syncing ? t('common.computing') : t('financials.computePersonnel')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncExpenses} disabled={syncingExpenses} className="gap-1.5">
              <Receipt className={cn('h-3.5 w-3.5', syncingExpenses && 'animate-spin')} />
              {syncingExpenses ? t('common.syncing') : t('financials.syncExpenses')}
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
