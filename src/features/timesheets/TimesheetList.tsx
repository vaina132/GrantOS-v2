import { useState } from 'react'
import { timesheetService } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useTimesheets } from '@/hooks/useTimesheets'
import { PageHeader } from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { ClipboardCheck, RefreshCw, Check, CheckCheck, X } from 'lucide-react'
import type { TimesheetEntry, TimesheetStatus } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function TimesheetList() {
  const { orgId, user, can } = useAuthStore()
  const { globalYear } = useUiStore()
  const [monthFilter, setMonthFilter] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | undefined>(undefined)
  const [generating, setGenerating] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState(false)

  const { entries, isLoading, refetch } = useTimesheets({
    month: monthFilter,
    status: statusFilter,
  })

  const handleGenerate = async () => {
    if (!orgId) return
    setGenerating(true)
    try {
      const result = await timesheetService.generate(orgId, globalYear, generateMonth)
      toast({ title: 'Generated', description: `${result.length} timesheet entries created for ${MONTHS[generateMonth - 1]} ${globalYear}.` })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleStatusChange = async (entry: TimesheetEntry, newStatus: TimesheetStatus) => {
    if (!user) return
    try {
      await timesheetService.updateStatus(entry.id, newStatus, user.id)
      toast({ title: `Timesheet ${newStatus.toLowerCase()}` })
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handlePercentageChange = async (entry: TimesheetEntry, value: number) => {
    try {
      await timesheetService.updatePercentage(entry.id, value)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleBulkAction = async (status: TimesheetStatus) => {
    if (!user || selected.size === 0) return
    setBulkAction(true)
    try {
      await timesheetService.bulkUpdateStatus(Array.from(selected), status, user.id)
      toast({ title: `${selected.size} entries ${status.toLowerCase()}` })
      setSelected(new Set())
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setBulkAction(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(entries.map((e) => e.id)))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        description={`Timesheet management for ${globalYear}`}
        actions={
          can('canManageAllocations') ? (
            <div className="flex items-center gap-2">
              <select
                value={generateMonth}
                onChange={(e) => setGenerateMonth(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                <RefreshCw className={`mr-1 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={!monthFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMonthFilter(undefined)}
          >
            All Months
          </Button>
          {MONTHS.map((m, i) => (
            <Button
              key={i}
              variant={monthFilter === i + 1 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMonthFilter(i + 1)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['All', 'Draft', 'Confirmed', 'Approved', 'Rejected'] as const).map((s) => (
          <Button
            key={s}
            variant={(s === 'All' ? !statusFilter : statusFilter === s) ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s === 'All' ? undefined : s as TimesheetStatus)}
          >
            {s}
          </Button>
        ))}
      </div>

      {selected.size > 0 && can('canManageAllocations') && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('Confirmed')} disabled={bulkAction}>
            <Check className="mr-1 h-3 w-3" /> Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('Approved')} disabled={bulkAction}>
            <CheckCheck className="mr-1 h-3 w-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('Rejected')} disabled={bulkAction}>
            <X className="mr-1 h-3 w-3" /> Reject
          </Button>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable columns={7} rows={8} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No timesheet entries"
          description="Generate timesheets from allocations using the Generate button above."
        />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {can('canManageAllocations') && (
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === entries.length && entries.length > 0}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2 text-left font-medium">Person</th>
                  <th className="px-4 py-2 text-left font-medium">Project</th>
                  <th className="px-4 py-2 text-center font-medium">Month</th>
                  <th className="px-4 py-2 text-right font-medium">Planned %</th>
                  <th className="px-4 py-2 text-right font-medium">Confirmed %</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  {can('canManageAllocations') && (
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                    {can('canManageAllocations') && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2 font-medium">
                      {(entry as any).persons?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-semibold text-primary">
                        {(entry as any).projects?.acronym ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {MONTHS[entry.month - 1]} {entry.year}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {entry.planned_percentage != null ? `${entry.planned_percentage.toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {entry.status === 'Draft' || entry.status === 'Rejected' ? (
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          defaultValue={entry.confirmed_percentage ?? entry.planned_percentage ?? ''}
                          className="w-20 ml-auto text-right h-7 text-xs"
                          onBlur={(e) => {
                            const val = Number(e.target.value)
                            if (!isNaN(val)) handlePercentageChange(entry, val)
                          }}
                        />
                      ) : (
                        <span className="tabular-nums">
                          {entry.confirmed_percentage != null ? `${entry.confirmed_percentage.toFixed(0)}%` : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={entry.status} />
                    </td>
                    {can('canManageAllocations') && (
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {entry.status === 'Draft' && (
                            <Button size="sm" variant="ghost" onClick={() => handleStatusChange(entry, 'Confirmed')}>
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          {entry.status === 'Confirmed' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(entry, 'Approved')}>
                                <CheckCheck className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(entry, 'Rejected')}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {entry.status === 'Rejected' && (
                            <Button size="sm" variant="ghost" onClick={() => handleStatusChange(entry, 'Draft')}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
