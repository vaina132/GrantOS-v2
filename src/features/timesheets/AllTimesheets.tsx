import { useState, useMemo } from 'react'
import { timesheetService } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useTimesheets } from '@/hooks/useTimesheets'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { ClipboardCheck, CheckCheck, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimesheetEntry, TimesheetStatus } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface PersonGroup {
  personId: string
  personName: string
  entries: TimesheetEntry[]
  totalPlanned: number
  totalActual: number
  overallStatus: TimesheetStatus | 'Mixed'
}

export function AllTimesheets() {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | undefined>(undefined)
  const [generating, setGenerating] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const { entries, isLoading, refetch } = useTimesheets({
    month: selectedMonth,
    status: statusFilter,
  })

  // Group entries by person
  const groups = useMemo(() => {
    const map = new Map<string, PersonGroup>()
    for (const e of entries) {
      const name = (e as any).persons?.full_name ?? '—'
      if (!map.has(e.person_id)) {
        map.set(e.person_id, {
          personId: e.person_id,
          personName: name,
          entries: [],
          totalPlanned: 0,
          totalActual: 0,
          overallStatus: e.status,
        })
      }
      const g = map.get(e.person_id)!
      g.entries.push(e)
      g.totalPlanned += e.planned_hours ?? 0
      g.totalActual += e.actual_hours ?? 0
      if (g.overallStatus !== e.status) g.overallStatus = 'Mixed'
    }
    return Array.from(map.values()).sort((a, b) => a.personName.localeCompare(b.personName))
  }, [entries])

  // Summary stats
  const stats = useMemo(() => {
    const total = entries.length
    const draft = entries.filter((e) => e.status === 'Draft').length
    const submitted = entries.filter((e) => e.status === 'Submitted').length
    const approved = entries.filter((e) => e.status === 'Approved').length
    const rejected = entries.filter((e) => e.status === 'Rejected').length
    return { total, draft, submitted, approved, rejected }
  }, [entries])

  const handleGenerate = async () => {
    if (!orgId) return
    setGenerating(true)
    try {
      const result = await timesheetService.generate(orgId, globalYear, selectedMonth)
      if (result.created === 0 && result.updated === 0) {
        toast({ title: 'Up to date', description: 'All timesheet entries are already in sync with allocations.' })
      } else {
        const parts: string[] = []
        if (result.created > 0) parts.push(`${result.created} created`)
        if (result.updated > 0) parts.push(`${result.updated} updated`)
        toast({ title: 'Synced', description: `Timesheet entries: ${parts.join(', ')}.` })
      }
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleBulkApprove = async (personId: string) => {
    if (!user) return
    const personEntries = entries.filter((e) => e.person_id === personId && e.status === 'Submitted')
    if (personEntries.length === 0) return
    setActionLoading(true)
    try {
      await timesheetService.bulkUpdateStatus(personEntries.map((e) => e.id), 'Approved', user.id)
      toast({ title: 'Approved', description: `${personEntries.length} entries approved.` })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkReject = async (personId: string) => {
    if (!user) return
    const personEntries = entries.filter((e) => e.person_id === personId && e.status === 'Submitted')
    if (personEntries.length === 0) return
    setActionLoading(true)
    try {
      await timesheetService.bulkUpdateStatus(personEntries.map((e) => e.id), 'Rejected', user.id)
      toast({ title: 'Rejected', description: `${personEntries.length} entries rejected.` })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveAll = async () => {
    if (!user) return
    const submittedEntries = entries.filter((e) => e.status === 'Submitted')
    if (submittedEntries.length === 0) return
    setActionLoading(true)
    try {
      await timesheetService.bulkUpdateStatus(submittedEntries.map((e) => e.id), 'Approved', user.id)
      toast({ title: 'Approved', description: `${submittedEntries.length} entries approved.` })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const statusFilters: { label: string; value: TimesheetStatus | undefined }[] = [
    { label: 'All', value: undefined },
    { label: `Draft (${stats.draft})`, value: 'Draft' },
    { label: `Submitted (${stats.submitted})`, value: 'Submitted' },
    { label: `Approved (${stats.approved})`, value: 'Approved' },
    { label: `Rejected (${stats.rejected})`, value: 'Rejected' },
  ]

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m} {globalYear}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', generating && 'animate-spin')} />
            {generating ? 'Syncing...' : 'Sync from Allocations'}
          </Button>
          {stats.submitted > 0 && (
            <Button size="sm" onClick={handleApproveAll} disabled={actionLoading} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Approve All Submitted ({stats.submitted})
            </Button>
          )}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
        {statusFilters.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              (statusFilter === f.value || (!statusFilter && !f.value))
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable columns={6} rows={6} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No timesheet entries"
          description='Click "Sync from Allocations" to generate timesheet entries for this month.'
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const hasSubmitted = group.entries.some((e) => e.status === 'Submitted')
            return (
              <div key={group.personId} className="rounded-lg border bg-card">
                {/* Person header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{group.personName}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.totalPlanned.toFixed(1)}h planned · {group.totalActual.toFixed(1)}h actual
                    </span>
                    {group.overallStatus !== 'Mixed' ? (
                      <StatusBadge status={group.overallStatus} />
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Mixed
                      </span>
                    )}
                  </div>
                  {hasSubmitted && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkApprove(group.personId)}
                        disabled={actionLoading}
                        className="gap-1 text-green-700 hover:text-green-800 hover:bg-green-50 h-7 text-xs"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkReject(group.personId)}
                        disabled={actionLoading}
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Entries */}
                <table className="w-full text-sm">
                  <tbody>
                    {group.entries.map((entry) => {
                      const planned = entry.planned_hours ?? 0
                      const actual = entry.actual_hours ?? 0
                      const diff = actual - planned
                      return (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-2 w-[200px]">
                            <span className="font-semibold text-primary text-xs">
                              {(entry as any).projects?.acronym ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground w-[100px]">
                            {planned.toFixed(1)}h planned
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs font-medium w-[100px]">
                            {actual > 0 ? `${actual.toFixed(1)}h actual` : '—'}
                          </td>
                          <td className={cn(
                            'px-4 py-2 text-right tabular-nums text-xs w-[80px]',
                            diff > 0.5 ? 'text-amber-600' : diff < -0.5 ? 'text-red-500' : 'text-muted-foreground',
                          )}>
                            {actual > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}h` : ''}
                          </td>
                          <td className="px-4 py-2 w-[100px]">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {entry.notes ?? ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
