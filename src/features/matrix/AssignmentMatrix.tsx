import { useMemo, useState, useEffect } from 'react'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useAssignments } from '@/hooks/useAllocations'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getWorkingDaysInMonth, hoursToPm } from '@/lib/pmUtils'
import { settingsService } from '@/services/settingsService'
import { timesheetService } from '@/services/timesheetService'
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function heatColor(value: number, fte: number): string {
  if (value === 0) return ''
  const ratio = value / fte
  if (ratio > 1) return 'bg-red-200 text-red-900'
  if (ratio > 0.8) return 'bg-orange-200 text-orange-900'
  if (ratio > 0.5) return 'bg-yellow-100 text-yellow-900'
  if (ratio > 0.2) return 'bg-green-100 text-green-900'
  return 'bg-green-50 text-green-800'
}

export function AssignmentMatrix() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff, isLoading: loadingStaff } = useStaff({ is_active: true })
  const { projects, isLoading: loadingProjects } = useProjects()
  const { assignments, isLoading: loadingAssignments } = useAssignments('actual')
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [timesheetsDriveAllocations, setTimesheetsDriveAllocations] = useState(false)
  const [tsAggregates, setTsAggregates] = useState<{ person_id: string; project_id: string; work_package_id: string | null; month: number; totalHours: number }[]>([])

  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      if (org?.working_hours_per_day) setHoursPerDay(org.working_hours_per_day)
      setTimesheetsDriveAllocations(org?.timesheets_drive_allocations ?? false)
    }).catch(() => {})
  }, [orgId])

  useEffect(() => {
    if (!orgId || !timesheetsDriveAllocations) { setTsAggregates([]); return }
    timesheetService.aggregateHoursByYear(orgId, globalYear).then(setTsAggregates).catch(() => setTsAggregates([]))
  }, [orgId, globalYear, timesheetsDriveAllocations])

  const isLoading = loadingStaff || loadingProjects || loadingAssignments

  // Build matrix: person -> month -> { total, projects: [{acronym, pms}] }
  const matrix = useMemo(() => {
    const projectMap = new Map(projects.map((p) => [p.id, p]))
    const personMap = new Map(staff.map((p) => [p.id, p]))

    type MonthData = { total: number; breakdown: { acronym: string; pms: number }[] }
    type PersonRow = {
      personId: string
      name: string
      fte: number
      months: MonthData[]
      yearTotal: number
    }

    const data = new Map<string, PersonRow>()

    const ensureRow = (personId: string) => {
      if (!data.has(personId)) {
        const person = personMap.get(personId)
        if (!person) return null
        data.set(personId, {
          personId,
          name: person.full_name,
          fte: person.fte,
          months: Array.from({ length: 12 }, () => ({ total: 0, breakdown: [] })),
          yearTotal: 0,
        })
      }
      return data.get(personId)!
    }

    if (timesheetsDriveAllocations && tsAggregates.length > 0) {
      // Use timesheet-derived PMs
      for (const agg of tsAggregates) {
        const row = ensureRow(agg.person_id)
        if (!row) continue
        const monthIdx = agg.month - 1
        const project = projectMap.get(agg.project_id)
        const acronym = project?.acronym ?? '?'
        const workingDays = getWorkingDaysInMonth(globalYear, agg.month)
        const pms = Math.round(hoursToPm(agg.totalHours, workingDays, hoursPerDay) * 100) / 100
        if (pms > 0) {
          row.months[monthIdx].total += pms
          row.months[monthIdx].breakdown.push({ acronym, pms })
          row.yearTotal += pms
        }
      }
    } else {
      // Use saved assignments
      for (const a of assignments) {
        const row = ensureRow(a.person_id)
        if (!row) continue
        const monthIdx = a.month - 1
        const project = projectMap.get(a.project_id)
        const acronym = project?.acronym ?? '?'
        row.months[monthIdx].total += a.pms
        row.months[monthIdx].breakdown.push({ acronym, pms: a.pms })
        row.yearTotal += a.pms
      }
    }

    return Array.from(data.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [staff, projects, assignments, timesheetsDriveAllocations, tsAggregates, globalYear, hoursPerDay])

  if (isLoading) return <SkeletonTable columns={14} rows={8} />

  if (matrix.length === 0) {
    return (
      <EmptyState
        icon={Grid3x3}
        title="No assignment data"
        description="Create allocations first to see the assignment matrix with heatmap."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Heatmap:</span>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-green-50 border" />
          <span>&lt;20%</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-green-100 border" />
          <span>20-50%</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-yellow-100 border" />
          <span>50-80%</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-orange-200 border" />
          <span>80-100%</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-red-200 border" />
          <span>&gt;100%</span>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 min-w-[150px]">Person</th>
              <th className="px-2 py-2 text-center font-medium min-w-[40px]">FTE</th>
              {MONTHS.map((m, i) => (
                <th key={i} className="px-1 py-2 text-center font-medium min-w-[50px]">{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium min-w-[50px]">Yr</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.personId} className="border-b last:border-0">
                <td className="px-3 py-1.5 sticky left-0 bg-background font-medium text-xs truncate max-w-[150px]">
                  {row.name}
                </td>
                <td className="px-2 py-1.5 text-center text-xs tabular-nums text-muted-foreground">
                  {row.fte.toFixed(1)}
                </td>
                {row.months.map((m, i) => (
                  <td
                    key={i}
                    className={cn(
                      'px-1 py-1.5 text-center text-xs tabular-nums',
                      heatColor(m.total, row.fte),
                    )}
                    title={
                      m.breakdown.length > 0
                        ? m.breakdown.map((b) => `${b.acronym}: ${b.pms.toFixed(2)}`).join('\n')
                        : undefined
                    }
                  >
                    {m.total > 0 ? m.total.toFixed(2) : ''}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right text-xs tabular-nums font-semibold">
                  {row.yearTotal > 0 ? row.yearTotal.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
