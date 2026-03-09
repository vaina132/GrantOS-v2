import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useProjects } from '@/hooks/useProjects'
import { useStaff } from '@/hooks/useStaff'
import { allocationsService } from '@/services/allocationsService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import type { Assignment } from '@/types'

export function SalaryCoverageChart() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { projects } = useProjects()
  const { staff } = useStaff({})

  const [year, setYear] = useState(globalYear)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch assignments for the selected year
  const fetchAssignments = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await allocationsService.listAssignments(orgId, year, 'actual')
      setAssignments(data)
    } catch {
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [orgId, year])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Compute salary coverage data
  const coverageData = useMemo(() => {
    // Total annual salaries of active staff (prorated by FTE)
    const activeStaff = staff.filter(s => s.is_active)
    const totalSalaries = activeStaff.reduce((sum, s) => {
      const salary = s.annual_salary ?? 0
      return sum + salary
    }, 0)

    // Build a map of project_id -> project for quick lookup
    const projectMap = new Map(projects.map(p => [p.id, p]))

    // Claimed = PMs allocated × PM rate per project
    // Use project's our_pm_rate if available, otherwise estimate from salary
    let totalClaimed = 0
    const personPms = new Map<string, number>() // person_id -> total PMs this year

    for (const a of assignments) {
      const proj = projectMap.get(a.project_id)
      const pmRate = proj?.our_pm_rate ?? 0
      totalClaimed += a.pms * pmRate
      personPms.set(a.person_id, (personPms.get(a.person_id) ?? 0) + a.pms)
    }

    // Total project personnel budgets (for active/upcoming projects)
    const totalPersonnelBudget = projects
      .filter(p => p.status === 'Active' || p.status === 'Upcoming')
      .reduce((sum, p) => sum + (p.budget_personnel ?? 0), 0)

    // Coverage percentage
    const coveragePct = totalSalaries > 0 ? Math.min((totalClaimed / totalSalaries) * 100, 100) : 0
    const potentialPct = totalSalaries > 0 ? Math.min((totalPersonnelBudget / totalSalaries) * 100, 999) : 0
    const uncoveredAmount = Math.max(0, totalSalaries - totalClaimed)

    return {
      totalSalaries,
      totalClaimed,
      totalPersonnelBudget,
      coveragePct,
      potentialPct,
      uncoveredAmount,
      activeStaffCount: activeStaff.length,
      allocatedStaffCount: personPms.size,
    }
  }, [staff, projects, assignments])

  // Bar chart data: per-person breakdown
  const chartData = useMemo(() => {
    const activeStaff = staff.filter(s => s.is_active && (s.annual_salary ?? 0) > 0)
    const projectMap = new Map(projects.map(p => [p.id, p]))

    return activeStaff.map(s => {
      const salary = s.annual_salary ?? 0
      // Sum this person's claimed amount from allocations
      let claimed = 0
      for (const a of assignments) {
        if (a.person_id !== s.id) continue
        const proj = projectMap.get(a.project_id)
        const pmRate = proj?.our_pm_rate ?? 0
        claimed += a.pms * pmRate
      }
      const uncovered = Math.max(0, salary - claimed)

      return {
        name: s.full_name.split(' ').map(n => n[0]).join('') || s.full_name.slice(0, 3),
        fullName: s.full_name,
        salary,
        claimed: Math.round(claimed),
        uncovered: Math.round(uncovered),
      }
    }).sort((a, b) => b.salary - a.salary)
  }, [staff, projects, assignments])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Salary Coverage by Projects</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums w-12 text-center">{year}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(y => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Salaries</div>
                <div className="text-lg font-bold tabular-nums mt-0.5">{formatCurrency(coverageData.totalSalaries)}</div>
                <div className="text-[11px] text-muted-foreground">{coverageData.activeStaffCount} active staff</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Claimed</div>
                <div className={cn('text-lg font-bold tabular-nums mt-0.5', coverageData.totalClaimed > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {formatCurrency(coverageData.totalClaimed)}
                </div>
                <div className="text-[11px] text-muted-foreground">{coverageData.coveragePct.toFixed(1)}% of salaries</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Uncovered</div>
                <div className={cn('text-lg font-bold tabular-nums mt-0.5', coverageData.uncoveredAmount > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                  {formatCurrency(coverageData.uncoveredAmount)}
                </div>
                <div className="text-[11px] text-muted-foreground">salary not yet claimed</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Personnel Budget</div>
                <div className="text-lg font-bold tabular-nums mt-0.5 text-blue-600">{formatCurrency(coverageData.totalPersonnelBudget)}</div>
                <div className="text-[11px] text-muted-foreground">total across projects</div>
              </div>
            </div>

            {/* Coverage progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Coverage: {coverageData.coveragePct.toFixed(1)}%</span>
                <span>{formatCurrency(coverageData.totalClaimed)} / {formatCurrency(coverageData.totalSalaries)}</span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(coverageData.coveragePct, 100)}%` }}
                  title={`Claimed: ${formatCurrency(coverageData.totalClaimed)}`}
                />
                {coverageData.coveragePct < 100 && (
                  <div
                    className="h-full bg-amber-300 transition-all"
                    style={{ width: `${Math.min(100 - coverageData.coveragePct, 100)}%` }}
                    title={`Uncovered: ${formatCurrency(coverageData.uncoveredAmount)}`}
                  />
                )}
              </div>
              <div className="flex gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Claimed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-300" /> Uncovered</span>
              </div>
            </div>

            {/* Per-person bar chart */}
            {chartData.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">Per-Person Breakdown</div>
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32 + 40)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={40} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'claimed' ? 'Claimed' : 'Uncovered']}
                      labelFormatter={(label: string) => {
                        const item = chartData.find(d => d.name === label)
                        return item ? `${item.fullName} — Salary: ${formatCurrency(item.salary)}` : label
                      }}
                    />
                    <Legend
                      formatter={(value: string) => value === 'claimed' ? 'Claimed' : 'Uncovered'}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="claimed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Bar>
                    <Bar dataKey="uncovered" stackId="a" fill="#fbbf24" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
