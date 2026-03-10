import { useMemo } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { useStaff } from '@/hooks/useStaff'
import { useAssignments } from '@/hooks/useAllocations'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  Users,
  CalendarDays,
  DollarSign,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { SalaryCoverageChart } from './SalaryCoverageChart'

const STATUS_COLORS: Record<string, string> = {
  Upcoming: '#3b82f6',
  Active: '#22c55e',
  Completed: '#6b7280',
  Suspended: '#ef4444',
}

export function Dashboard() {
  const navigate = useNavigate()
  const { can } = useAuthStore()
  const { globalYear } = useUiStore()
  const { projects, isLoading: loadingProjects } = useProjects()
  const { staff, isLoading: loadingStaff } = useStaff({})
  const { assignments, isLoading: loadingAssignments } = useAssignments('actual')

  const isLoading = loadingProjects || loadingStaff || loadingAssignments

  // KPI data
  const kpis = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === 'Active')
    const totalBudget = projects.reduce((sum, p) => sum + (p.total_budget ?? 0), 0)
    const activeStaff = staff.filter((s) => s.is_active)
    const totalPms = assignments.reduce((sum, a) => sum + a.pms, 0)

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      totalStaff: staff.length,
      activeStaff: activeStaff.length,
      totalBudget,
      totalPms: totalPms.toFixed(1),
    }
  }, [projects, staff, assignments])

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      counts[p.status] = (counts[p.status] ?? 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [projects])

  // Monthly allocation bar chart
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const data = months.map((name) => ({
      name,
      pms: 0,
    }))
    for (const a of assignments) {
      if (a.month >= 1 && a.month <= 12) {
        data[a.month - 1].pms += a.pms
      }
    }
    return data.map((d) => ({ ...d, pms: Number(d.pms.toFixed(2)) }))
  }, [assignments])

  // Alerts
  const alerts = useMemo(() => {
    const items: { message: string; type: 'warning' | 'info' }[] = []

    const now = new Date()
    const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
    const endingSoon = projects.filter((p) => p.status === 'Active' && new Date(p.end_date) <= sixMonthsFromNow)
    if (endingSoon.length > 0) {
      items.push({
        message: `${endingSoon.length} project${endingSoon.length > 1 ? 's' : ''} ending soon: ${endingSoon.map((p) => p.acronym).join(', ')}`,
        type: 'warning',
      })
    }

    // Over-allocated staff
    const personTotals = new Map<string, number>()
    for (const a of assignments) {
      personTotals.set(a.person_id, (personTotals.get(a.person_id) ?? 0) + a.pms)
    }
    const overAllocated = staff.filter((s) => {
      const total = personTotals.get(s.id) ?? 0
      return total > s.fte * 12
    })
    if (overAllocated.length > 0) {
      items.push({
        message: `${overAllocated.length} staff member${overAllocated.length > 1 ? 's' : ''} over-allocated this year`,
        type: 'warning',
      })
    }

    return items
  }, [projects, staff, assignments])

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Portfolio overview — ${globalYear}`} />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Projects', value: kpis.totalProjects, sub: `${kpis.activeProjects} active`, icon: FolderKanban, color: 'text-blue-600', href: '/projects' },
          { label: 'Staff', value: kpis.totalStaff, sub: `${kpis.activeStaff} active`, icon: Users, color: 'text-emerald-600', href: '/staff' },
          ...(can('canSeeFinancialDetails') ? [{ label: 'Total Budget', value: formatCurrency(kpis.totalBudget), sub: 'across all projects', icon: DollarSign, color: 'text-amber-600', href: '/financials' }] : []),
          { label: 'Person-Months', value: kpis.totalPms, sub: `allocated in ${globalYear}`, icon: CalendarDays, color: 'text-purple-600', href: '/allocations' },
        ].map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate(kpi.href)}
          >
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
                  </div>
                  <div className={`rounded-lg bg-muted p-2`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-sm text-amber-800">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {!isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Allocations (PMs)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pms" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No projects yet</p>
              ) : (
                <div className="space-y-4">
                  {/* Stacked bar */}
                  <div className="flex h-8 w-full overflow-hidden rounded-lg">
                    {statusData.map((entry) => {
                      const total = statusData.reduce((s, d) => s + d.value, 0)
                      const pct = total > 0 ? (entry.value / total) * 100 : 0
                      return (
                        <div
                          key={entry.name}
                          className="flex items-center justify-center text-xs font-semibold text-white transition-all"
                          style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[entry.name] ?? '#6b7280', minWidth: pct > 0 ? '24px' : '0' }}
                          title={`${entry.name}: ${entry.value}`}
                        >
                          {pct >= 12 ? entry.value : ''}
                        </div>
                      )
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4">
                    {statusData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[entry.name] ?? '#6b7280' }} />
                        <span className="text-sm text-muted-foreground">{entry.name}</span>
                        <span className="text-sm font-semibold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Salary Coverage */}
      {!isLoading && can('canSeeSalary') && <SalaryCoverageChart />}

      {/* Project Table */}
      {!isLoading && projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Acronym</th>
                    <th className="px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    {can('canSeeFinancialDetails') && <th className="px-4 py-2 text-right font-medium">Budget</th>}
                    <th className="px-4 py-2 text-right font-medium">PMs ({globalYear})</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const projectPms = assignments
                      .filter((a) => a.project_id === p.id)
                      .reduce((sum, a) => sum + a.pms, 0)
                    return (
                      <tr
                        key={p.id}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <td className="px-4 py-2 font-semibold text-primary">{p.acronym}</td>
                        <td className="px-4 py-2 text-muted-foreground">{p.title}</td>
                        <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                        {can('canSeeFinancialDetails') && <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(p.total_budget)}</td>}
                        <td className="px-4 py-2 text-right tabular-nums">{projectPms > 0 ? projectPms.toFixed(2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
