import { useMemo } from 'react'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useAssignments } from '@/hooks/useAllocations'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssignmentType } from '@/types'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function intensityColor(value: number): string {
  if (value === 0) return ''
  if (value > 5) return 'bg-blue-300 text-blue-950'
  if (value > 3) return 'bg-blue-200 text-blue-900'
  if (value > 1) return 'bg-blue-100 text-blue-900'
  return 'bg-blue-50 text-blue-800'
}

interface ProjectMatrixProps {
  type: AssignmentType
}

export function ProjectMatrix({ type }: ProjectMatrixProps) {
  const { staff, isLoading: loadingStaff } = useStaff({ is_active: true })
  const { projects, isLoading: loadingProjects } = useProjects()
  const { assignments, isLoading: loadingAssignments } = useAssignments(type)

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

    for (const a of assignments) {
      const project = projectMap.get(a.project_id)
      if (!project) continue

      if (!data.has(a.project_id)) {
        data.set(a.project_id, {
          projectId: a.project_id,
          acronym: project.acronym,
          title: project.title,
          months: Array.from({ length: 12 }, () => ({ total: 0, breakdown: [] })),
          yearTotal: 0,
        })
      }

      const row = data.get(a.project_id)!
      const monthIdx = a.month - 1
      const person = personMap.get(a.person_id)
      const name = person?.full_name ?? '?'

      row.months[monthIdx].total += a.pms
      row.months[monthIdx].breakdown.push({ name, pms: a.pms })
      row.yearTotal += a.pms
    }

    return Array.from(data.values()).sort((a, b) => a.acronym.localeCompare(b.acronym))
  }, [staff, projects, assignments])

  if (isLoading) return <SkeletonTable columns={14} rows={8} />

  if (matrix.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No assignment data"
        description="Create allocations first to see the project assignment matrix."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Intensity:</span>
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
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 min-w-[150px]">Project</th>
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
