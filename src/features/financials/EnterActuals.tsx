import { useMemo } from 'react'
import { financialService, type BudgetCategory } from '@/services/financialService'
import { useFinancialBudgets } from '@/hooks/useFinancials'
import { useProjects } from '@/hooks/useProjects'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const CATEGORIES: { key: BudgetCategory; label: string }[] = [
  { key: 'personnel', label: 'Personnel' },
  { key: 'travel', label: 'Travel' },
  { key: 'subcontracting', label: 'Subcontracting' },
  { key: 'other', label: 'Other Direct' },
  { key: 'indirect', label: 'Indirect Costs' },
]

interface ProjectRow {
  projectId: string
  acronym: string
  categories: Record<BudgetCategory, { id: string | null; budgeted: number; actual: number }>
}

export function EnterActuals() {
  const { budgets, isLoading: loadingBudgets, refetch } = useFinancialBudgets()
  const { projects, isLoading: loadingProjects } = useProjects()
  const isLoading = loadingBudgets || loadingProjects

  const rows = useMemo(() => {
    const map = new Map<string, ProjectRow>()

    for (const p of projects) {
      const row: ProjectRow = {
        projectId: p.id,
        acronym: p.acronym,
        categories: {
          personnel: { id: null, budgeted: 0, actual: 0 },
          travel: { id: null, budgeted: 0, actual: 0 },
          subcontracting: { id: null, budgeted: 0, actual: 0 },
          other: { id: null, budgeted: 0, actual: 0 },
          indirect: { id: null, budgeted: 0, actual: 0 },
        },
      }
      map.set(p.id, row)
    }

    for (const b of budgets) {
      let row = map.get(b.project_id)
      if (!row) continue
      const cat = b.category as BudgetCategory
      if (row.categories[cat]) {
        row.categories[cat] = { id: b.id, budgeted: b.budgeted, actual: b.actual }
      }
    }

    return Array.from(map.values())
      .filter((r) => {
        // Only show projects that have at least one budget row
        return Object.values(r.categories).some((c) => c.id !== null)
      })
      .sort((a, b) => a.acronym.localeCompare(b.acronym))
  }, [projects, budgets])

  const handleActualChange = async (budgetId: string, value: number) => {
    try {
      await financialService.updateActual(budgetId, value)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  if (isLoading) return <SkeletonTable columns={6} rows={6} />

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No budget data"
        description='Click "Sync Budgets from Projects" above to create budget rows from your project data.'
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edit actual spending per category. Personnel actuals can be auto-computed from allocation data using the button above.
        Other categories (travel, subcontracting, etc.) must be entered manually.
      </p>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium sticky left-0 bg-muted/50 min-w-[120px]">Project</th>
              {CATEGORIES.map((cat) => (
                <th key={cat.key} className="px-3 py-2.5 text-center font-medium border-l min-w-[160px]">
                  {cat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.projectId} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2 font-semibold text-primary sticky left-0 bg-background">
                  {row.acronym}
                </td>
                {CATEGORIES.map((cat) => {
                  const cell = row.categories[cat.key]
                  if (!cell.id) {
                    return (
                      <td key={cat.key} className="px-3 py-2 text-center text-muted-foreground text-xs border-l">
                        —
                      </td>
                    )
                  }
                  const variance = cell.budgeted - cell.actual
                  const isPersonnel = cat.key === 'personnel'
                  return (
                    <td key={cat.key} className="px-3 py-2 border-l">
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground text-right">
                          Budget: {formatCurrency(cell.budgeted)}
                        </div>
                        {isPersonnel ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="tabular-nums text-xs font-medium">{formatCurrency(cell.actual)}</span>
                            <span className="text-[9px] text-muted-foreground">(auto)</span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            step="100"
                            min="0"
                            defaultValue={cell.actual || ''}
                            placeholder="0"
                            className="h-7 text-xs text-right tabular-nums w-full"
                            onBlur={(e) => {
                              const val = Number(e.target.value)
                              if (!isNaN(val) && val >= 0 && cell.id) {
                                handleActualChange(cell.id, val)
                              }
                            }}
                          />
                        )}
                        {cell.actual > 0 && (
                          <div className={cn(
                            'text-[10px] text-right tabular-nums',
                            variance >= 0 ? 'text-green-600' : 'text-red-600',
                          )}>
                            {variance >= 0 ? 'Under' : 'Over'} by {formatCurrency(Math.abs(variance))}
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Personnel actuals are auto-computed from allocations × salaries</span>
        <span>Other categories: enter actual spending manually</span>
      </div>
    </div>
  )
}
