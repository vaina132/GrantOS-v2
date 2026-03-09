import { useState, useMemo } from 'react'
import { timesheetService, getWorkingDays } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { useTimesheets } from '@/hooks/useTimesheets'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { ClipboardCheck, Send, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimesheetEntry } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MyTimesheet() {
  const { orgId, user, can } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff } = useStaff({ is_active: true })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)

  const { entries, isLoading, refetch } = useTimesheets({
    month: selectedMonth,
    person_id: selectedPersonId || undefined,
  })

  const workingDays = useMemo(() => getWorkingDays(globalYear, selectedMonth), [globalYear, selectedMonth])
  const totalPlanned = useMemo(() => entries.reduce((s, e) => s + (e.planned_hours ?? 0), 0), [entries])
  const totalActual = useMemo(() => entries.reduce((s, e) => s + (e.actual_hours ?? 0), 0), [entries])

  const draftEntries = useMemo(() => entries.filter((e) => e.status === 'Draft'), [entries])
  const canSubmit = draftEntries.length > 0 && draftEntries.every((e) => (e.actual_hours ?? 0) > 0)

  const handleActualHoursChange = async (entry: TimesheetEntry, value: number) => {
    try {
      await timesheetService.updateActualHours(entry.id, value)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleSubmitAll = async () => {
    if (!user || draftEntries.length === 0) return
    setSubmitting(true)
    try {
      await timesheetService.submit(
        draftEntries.map((e) => e.id),
        user.id,
      )
      toast({ title: 'Submitted', description: `${draftEntries.length} timesheet entries submitted for approval.` })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Person</label>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All personnel</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
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

        <div className="flex gap-2">
          {can('canManageAllocations') && (
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', generating && 'animate-spin')} />
              {generating ? 'Syncing...' : 'Sync from Allocations'}
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" onClick={handleSubmitAll} disabled={submitting} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Submitting...' : `Submit ${draftEntries.length} Entries`}
            </Button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Working Days</div>
            <div className="text-lg font-semibold mt-0.5">{workingDays}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Planned Hours</div>
            <div className="text-lg font-semibold mt-0.5">{totalPlanned.toFixed(1)}h</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Actual Hours</div>
            <div className="text-lg font-semibold mt-0.5">{totalActual.toFixed(1)}h</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Difference</div>
            <div className={cn(
              'text-lg font-semibold mt-0.5',
              totalActual - totalPlanned > 0.5 ? 'text-amber-600' : totalActual - totalPlanned < -0.5 ? 'text-red-500' : 'text-green-600',
            )}>
              {totalActual - totalPlanned > 0 ? '+' : ''}{(totalActual - totalPlanned).toFixed(1)}h
            </div>
          </div>
        </div>
      )}

      {/* Entries table */}
      {isLoading ? (
        <SkeletonTable columns={6} rows={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No timesheet entries"
          description={can('canManageAllocations')
            ? 'Click "Sync from Allocations" to generate timesheet entries from your allocation data.'
            : 'No timesheet entries found for this period.'}
        />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium">Project</th>
                  <th className="px-4 py-2.5 text-right font-medium">Planned</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actual Hours</th>
                  <th className="px-4 py-2.5 text-right font-medium">Diff</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const planned = entry.planned_hours ?? 0
                  const actual = entry.actual_hours ?? 0
                  const diff = actual - planned
                  const isEditable = entry.status === 'Draft' || entry.status === 'Rejected'

                  return (
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-primary">
                          {(entry as any).projects?.acronym ?? '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {(entry as any).projects?.title ?? ''}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {planned.toFixed(1)}h
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isEditable ? (
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            defaultValue={actual || ''}
                            placeholder="0"
                            className="w-20 ml-auto text-right h-8 text-xs tabular-nums"
                            onBlur={(e) => {
                              const val = Number(e.target.value)
                              if (!isNaN(val) && val >= 0) handleActualHoursChange(entry, val)
                            }}
                          />
                        ) : (
                          <span className="tabular-nums font-medium">{actual.toFixed(1)}h</span>
                        )}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-right tabular-nums text-xs',
                        diff > 0.5 ? 'text-amber-600' : diff < -0.5 ? 'text-red-500' : 'text-muted-foreground',
                      )}>
                        {actual > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {isEditable ? (
                          <Input
                            type="text"
                            defaultValue={entry.notes ?? ''}
                            placeholder="Optional notes..."
                            className="h-8 text-xs min-w-[120px]"
                            onBlur={(e) => {
                              if (e.target.value !== (entry.notes ?? '')) {
                                timesheetService.updateNotes(entry.id, e.target.value)
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{entry.notes ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
