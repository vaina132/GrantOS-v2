import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useAssignments } from '@/hooks/useAllocations'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getWorkingDaysInMonth, hoursToPm } from '@/lib/pmUtils'
import { settingsService } from '@/services/settingsService'
import { timesheetService } from '@/services/timesheetService'
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function intensityColor(value: number): string {
  if (value === 0) return ''
  if (value > 5) return 'bg-blue-300 text-blue-950'
  if (value > 3) return 'bg-blue-200 text-blue-900'
  if (value > 1) return 'bg-blue-100 text-blue-900'
  return 'bg-blue-50 text-blue-800'
}

export function ProjectMatrix() {
  const { t } = useTranslation()
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

  // Build matrix: project -> month -> { total, personnel: [{name, pms}] }
  const matrix = useMemo(() => {
    const projectMap = new Map(projects.map((p) => [p.id, p]))
    const personMap = new Map(staff.map((p) => [p.id, p]))

    type MonthData = { total: number; breakdown: { name: string; pms: number }[] }
    type ProjectRow = {
      projectId: string
      acronym: string
      title: string
      months: MonthData[]
      yearTotal: number
    }

    const data = new Map<string, ProjectRow>()

    const ensureRow = (projectId: string) => {
      if (!data.has(projectId)) {
        const project = projectMap.get(projectId)
        if (!project) return null
        data.set(projectId, {
          projectId,
          acronym: project.acronym,
          title: project.title,
          months: Array.from({ length: 12 }, () => ({ total: 0, breakdown: [] })),
          yearTotal: 0,
        })
      }
      return data.get(projectId)!
    }

    if (timesheetsDriveAllocations && tsAggregates.length > 0) {
      // Use timesheet-derived PMs
      for (const agg of tsAggregates) {
        const row = ensureRow(agg.project_id)
        if (!row) continue
        const monthIdx = agg.month - 1
        const person = personMap.get(agg.person_id)
        const name = person?.full_name ?? '?'
        const workingDays = getWorkingDaysInMonth(globalYear, agg.month)
        const pms = Math.round(hoursToPm(agg.totalHours, workingDays, hoursPerDay) * 100) / 100
        if (pms > 0) {
          row.months[monthIdx].total += pms
          row.months[monthIdx].breakdown.push({ name, pms })
          row.yearTotal += pms
        }
      }
    } else {
      // Use saved assignments
      for (const a of assignments) {
        const row = ensureRow(a.project_id)
        if (!row) continue
        const monthIdx = a.month - 1
        const person = personMap.get(a.person_id)
        const name = person?.full_name ?? '?'
        row.months[monthIdx].total += a.pms
        row.months[monthIdx].breakdown.push({ name, pms: a.pms })
        row.yearTotal += a.pms
      }
    }

    return Array.from(data.values()).sort((a, b) => a.acronym.localeCompare(b.acronym))
  }, [staff, projects, assignments, timesheetsDriveAllocations, tsAggregates, globalYear, hoursPerDay])

  if (isLoading) return <SkeletonTable columns={14} rows={8} />

  if (matrix.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title={t('allocations.noAssignmentData')}
        description={t('allocations.noAssignmentDataDesc')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">{t('allocations.intensity')}:</span>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-blue-50 border" />
          <span>&le;1 PM</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-blue-100 border" />
          <span>1-3 PM</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-blue-200 border" />
          <span>3-5 PM</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="inline-block w-6 h-4 rounded bg-blue-300 border" />
          <span>&gt;5 PM</span>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 min-w-[150px]">{t('common.project')}</th>
              {MONTHS.map((m, i) => (
                <th key={i} className="px-1 py-2 text-center font-medium min-w-[50px]">{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium min-w-[50px]">Yr</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.projectId} className="border-b last:border-0">
                <td
                  className="px-3 py-1.5 sticky left-0 bg-background font-medium text-xs truncate max-w-[150px]"
                  title={row.title}
                >
                  {row.acronym}
                </td>
                {row.months.map((m, i) => (
                  <td
                    key={i}
                    className={cn(
                      'px-1 py-1.5 text-center text-xs tabular-nums',
                      intensityColor(m.total),
                    )}
                    title={
                      m.breakdown.length > 0
                        ? m.breakdown.map((b) => `${b.name}: ${b.pms.toFixed(2)}`).join('\n')
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
