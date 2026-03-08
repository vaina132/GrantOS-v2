import { useMemo } from 'react'
import { useBudgetSummary } from '@/hooks/useFinancials'
import { useProjects } from '@/hooks/useProjects'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { BudgetCategory } from '@/services/financialService'

const CATEGORIES: { key: BudgetCategory; label: string }[] = [
  { key: 'personnel', label: 'Personnel' },
  { key: 'travel', label: 'Travel' },
  { key: 'subcontracting', label: 'Subcontracting' },
  { key: 'other', label: 'Other Direct' },
  { key: 'indirect', label: 'Indirect Costs' },
]

interface ProjectBudget {
  projectId: string
  acronym: string
  categories: Record<BudgetCategory, { budgeted: number; actual: number }>
  totalBudgeted: number
  totalActual: number
}

export function BudgetVsActuals() {
  const { rows, isLoading: loadingBudgets } = useBudgetSummary()
  const { projects, isLoading: loadingProjects } = useProjects()
  const isLoading = loadingBudgets || loadingProjects

  const projectBudgets = useMemo(() => {
    const map = new Map<string, ProjectBudget>()

    // Init from projects
    for (const p of projects) {
      map.set(p.id, {
        projectId: p.id,
        acronym: p.acronym,
        categories: {
          personnel: { budgeted: 0, actual: 0 },
          travel: { budgeted: 0, actual: 0 },
          subcontracting: { budgeted: 0, actual: 0 },
          other: { budgeted: 0, actual: 0 },
          indirect: { budgeted: 0, actual: 0 },
        },
        totalBudgeted: 0,
        totalActual: 0,
      })
    }

    // Fill from budget data
    for (const row of rows) {
      let pb = map.get(row.project_id)
      if (!pb) {
        pb = {
          projectId: row.project_id,
          acronym: row.project_acronym,
          categories: {
            personnel: { budgeted: 0, actual: 0 },
            travel: { budgeted: 0, actual: 0 },
            subcontracting: { budgeted: 0, actual: 0 },
            other: { budgeted: 0, actual: 0 },
            indirect: { budgeted: 0, actual: 0 },
          },
          totalBudgeted: 0,
          totalActual: 0,
        }
        map.set(row.project_id, pb)
      }
      const cat = pb.categories[row.category]
      if (cat) {
        cat.budgeted += row.budgeted
        cat.actual += row.actual
      }
      pb.totalBudgeted += row.budgeted
      pb.totalActual += row.actual
    }

    return Array.from(map.values()).sort((a, b) => a.acronym.localeCompare(b.acronym))
  }, [projects, rows])

  // Grand totals
  const grandTotals = useMemo(() => {
    const totals: Record<BudgetCategory, { budgeted: number; actual: number }> = {
      personnel: { budgeted: 0, actual: 0 },
      travel: { budgeted: 0, actual: 0 },
      subcontracting: { budgeted: 0, actual: 0 },
      other: { budgeted: 0, actual: 0 },
      indirect: { budgeted: 0, actual: 0 },
    }
    let totalBudgeted = 0
    let totalActual = 0

    for (const pb of projectBudgets) {
      for (const cat of CATEGORIES) {
        totals[cat.key].budgeted += pb.categories[cat.key].budgeted
        totals[cat.key].actual += pb.categories[cat.key].actual
      }
      totalBudgeted += pb.totalBudgeted
      totalActual += pb.totalActual
    }

    return { categories: totals, totalBudgeted, totalActual }
  }, [projectBudgets])

  if (isLoading) return <SkeletonTable columns={6} rows={6} />

  if (projectBudgets.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No financial data"
        description="Add projects and budget entries to see the budget vs actuals overview."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium sticky left-0 bg-muted/50" rowSpan={2}>Project</th>
              {CATEGORIES.map((cat) => (
                <th key={cat.key} className="px-2 py-1 text-center font-medium border-l" colSpan={2}>{cat.label}</th>
              ))}
              <th className="px-4 py-1 text-center font-medium border-l" colSpan={2}>Total</th>
            </tr>
            <tr className="border-b bg-muted/30">
              {CATEGORIES.map((cat) => (
                <th key={cat.key} className="border-l" colSpan={1}>
                  {/* Two sub-headers */}
                </th>
              ))}
              {/* This is tricky with colSpan, let me simplify */}
            </tr>
          </thead>
          <tbody>
            {projectBudgets.map((pb) => (
              <tr key={pb.projectId} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2 font-semibold text-primary sticky left-0 bg-background">{pb.acronym}</td>
                {CATEGORIES.map((cat) => {
                  const { budgeted, actual } = pb.categories[cat.key]
                  const variance = budgeted - actual
                  return (
                    <td key={cat.key} className="px-2 py-2 text-right border-l" colSpan={2}>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-muted-foreground">{formatCurrency(budgeted)}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(actual)}</span>
                        {budgeted > 0 && (
                          <span className={cn('text-[10px]', variance >= 0 ? 'text-green-600' : 'text-red-600')}>
                            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="px-4 py-2 text-right border-l" colSpan={2}>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs text-muted-foreground">{formatCurrency(pb.totalBudgeted)}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(pb.totalActual)}</span>
                    <span className={cn('text-[10px]', (pb.totalBudgeted - pb.totalActual) >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {(pb.totalBudgeted - pb.totalActual) >= 0 ? '+' : ''}{formatCurrency(pb.totalBudgeted - pb.totalActual)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {/* Grand total row */}
            <tr className="border-t-2 bg-muted/30 font-semibold">
              <td className="px-4 py-2 sticky left-0 bg-muted/30">TOTAL</td>
              {CATEGORIES.map((cat) => {
                const { budgeted, actual } = grandTotals.categories[cat.key]
                return (
                  <td key={cat.key} className="px-2 py-2 text-right border-l" colSpan={2}>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs">{formatCurrency(budgeted)}</span>
                      <span className="tabular-nums">{formatCurrency(actual)}</span>
                    </div>
                  </td>
                )
              })}
              <td className="px-4 py-2 text-right border-l" colSpan={2}>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs">{formatCurrency(grandTotals.totalBudgeted)}</span>
                  <span className="tabular-nums">{formatCurrency(grandTotals.totalActual)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Top row: <strong>Budgeted</strong></span>
        <span>Middle: <strong>Actual</strong></span>
        <span className="text-green-600">Green: Under budget</span>
        <span className="text-red-600">Red: Over budget</span>
      </div>
    </div>
  )
}
