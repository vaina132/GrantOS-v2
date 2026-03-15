import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { financialService } from '@/services/financialService'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { FinancialBudget, Project } from '@/types'

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  personnel: 'projects.personnel',
  travel: 'projects.travel',
  subcontracting: 'projects.subcontracting',
  other: 'budgetChart.other',
  indirect: 'budgetChart.indirect',
}


interface Props {
  project: Project
  projectYears: number[]
}

export function BudgetConsumptionChart({ project, projectYears }: Props) {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const [budgets, setBudgets] = useState<FinancialBudget[]>([])
  const [loading, setLoading] = useState(true)

  const loadBudgets = useCallback(async () => {
    if (!orgId || projectYears.length === 0) return
    setLoading(true)
    try {
      const all: FinancialBudget[] = []
      for (const year of projectYears) {
        const data = await financialService.listBudgets(orgId, year)
        const projectData = data.filter(b => b.project_id === project.id)
        all.push(...projectData)
      }
      setBudgets(all)
    } catch {
      setBudgets([])
    } finally {
      setLoading(false)
    }
  }, [orgId, project.id, projectYears])

  useEffect(() => {
    loadBudgets()
  }, [loadBudgets])

  // Aggregate by category across all years
  const categoryData = useMemo(() => {
    const categories = ['personnel', 'travel', 'subcontracting', 'other', 'indirect']
    return categories.map(cat => {
      const rows = budgets.filter(b => b.category === cat)
      const budgeted = rows.reduce((sum, r) => sum + r.budgeted, 0)
      const actual = rows.reduce((sum, r) => sum + r.actual, 0)
      return {
        category: t(CATEGORY_LABEL_KEYS[cat] ?? cat),
        key: cat,
        budgeted: Math.round(budgeted * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        pct: budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0,
      }
    }).filter(d => d.budgeted > 0 || d.actual > 0)
  }, [budgets])

  // Overall totals
  const totalBudgeted = categoryData.reduce((s, d) => s + d.budgeted, 0)
  const totalActual = categoryData.reduce((s, d) => s + d.actual, 0)
  const overallPct = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0

  // Time progress: how far along is the project?
  const timeProgress = useMemo(() => {
    const start = new Date(project.start_date).getTime()
    const end = new Date(project.end_date).getTime()
    const now = Date.now()
    if (now <= start) return 0
    if (now >= end) return 100
    return Math.round(((now - start) / (end - start)) * 100)
  }, [project.start_date, project.end_date])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('budgetChart.title')}</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    )
  }

  if (categoryData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('budgetChart.title')}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('budgetChart.noData')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('budgetChart.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {/* Overall progress indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('budgetChart.totalBudgeted')}</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">
              {totalBudgeted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('budgetChart.totalActual')}</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">
              {totalActual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('budgetChart.budgetUsed')}</div>
            <div className={cn('text-lg font-bold tabular-nums mt-0.5', overallPct > 90 ? 'text-red-500' : overallPct > 70 ? 'text-amber-500' : 'text-emerald-600')}>
              {overallPct}%
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('budgetChart.timeElapsed')}</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{timeProgress}%</div>
            <div className="text-[10px] text-muted-foreground">
              {overallPct > timeProgress + 15
                ? t('budgetChart.spendingAhead')
                : overallPct < timeProgress - 15
                ? t('budgetChart.underSpending')
                : t('budgetChart.onTrack')}
            </div>
          </div>
        </div>

        {/* Bar chart: budgeted vs actual per category */}
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                  name,
                ]}
              />
              <Legend />
              <Bar dataKey="budgeted" name={t('budgetChart.budgeted')} fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name={t('budgetChart.actual')} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-category progress bars */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('budgetChart.categoryBreakdown')}</div>
          {categoryData.map(d => (
            <div key={d.key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{d.category}</span>
                <span className="tabular-nums text-muted-foreground">
                  {d.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {d.budgeted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  <span className={cn('ml-2 font-semibold', d.pct > 90 ? 'text-red-500' : d.pct > 70 ? 'text-amber-500' : 'text-emerald-600')}>
                    ({d.pct}%)
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', d.pct > 90 ? 'bg-red-500' : d.pct > 70 ? 'bg-amber-500' : 'bg-primary')}
                  style={{ width: `${Math.min(d.pct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
