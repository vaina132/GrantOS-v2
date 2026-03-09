import { useState, useMemo, useEffect, useCallback } from 'react'
import { timesheetService, getWorkingDays } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { settingsService } from '@/services/settingsService'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { ClipboardCheck, CheckCheck, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hoursToPm, formatPm } from '@/lib/pmUtils'
import type { TimesheetEntry, TimesheetStatus, Person } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_BORDER: Record<string, string> = {
  Draft: 'border-l-slate-400',
  Submitted: 'border-l-amber-500',
  Approved: 'border-l-emerald-500',
  Rejected: 'border-l-red-500',
}

interface PersonEnvelope {
  person: Person
  envelope: TimesheetEntry | null
  totalHours: number
  status: TimesheetStatus
}

export function AllTimesheets() {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff, isLoading: staffLoading } = useStaff({ is_active: true })
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState(false)
  const [envelopes, setEnvelopes] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hoursPerDay, setHoursPerDay] = useState(8)

  // Load org settings
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      if (org?.working_hours_per_day) setHoursPerDay(org.working_hours_per_day)
    }).catch(() => {})
  }, [orgId])

  // Load envelopes for all staff
  const loadEnvelopes = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await timesheetService.listEnvelopes(orgId, {
        year: globalYear,
        month: selectedMonth,
        status: statusFilter,
      })
      setEnvelopes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load envelopes'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear, selectedMonth, statusFilter])

  useEffect(() => { loadEnvelopes() }, [loadEnvelopes])

  // Build person + envelope pairs
  const personEnvelopes: PersonEnvelope[] = useMemo(() => {
    const envMap = new Map<string, TimesheetEntry>()
    for (const e of envelopes) {
      envMap.set(e.person_id, e)
    }

    return staff.map(p => {
      const env = envMap.get(p.id) ?? null
      return {
        person: p,
        envelope: env,
        totalHours: env?.total_hours ?? 0,
        status: env?.status ?? 'Draft',
      }
    }).sort((a, b) => {
      // Submitted first, then Draft, then Approved, then Rejected
      const order: Record<string, number> = { Submitted: 0, Draft: 1, Rejected: 2, Approved: 3 }
      const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4)
      if (diff !== 0) return diff
      return a.person.full_name.localeCompare(b.person.full_name)
    })
  }, [staff, envelopes])

  // Filter if needed
  const filteredPersons = useMemo(() => {
    if (!statusFilter) return personEnvelopes
    return personEnvelopes.filter(pe => pe.status === statusFilter)
  }, [personEnvelopes, statusFilter])

  // Stats
  const stats = useMemo(() => {
    const draft = personEnvelopes.filter(pe => pe.status === 'Draft').length
    const submitted = personEnvelopes.filter(pe => pe.status === 'Submitted').length
    const approved = personEnvelopes.filter(pe => pe.status === 'Approved').length
    const rejected = personEnvelopes.filter(pe => pe.status === 'Rejected').length
    return { draft, submitted, approved, rejected, total: personEnvelopes.length }
  }, [personEnvelopes])

  const workingDays = getWorkingDays(globalYear, selectedMonth)
  const maxCapacity = workingDays * hoursPerDay

  // Actions
  const handleApprove = async (personId: string) => {
    if (!orgId || !user) return
    setActionLoading(true)
    try {
      await timesheetService.updateEnvelopeStatus(orgId, personId, globalYear, selectedMonth, 'Approved', user.id)
      // Sync approved hours → actual PMs in assignments
      await timesheetService.syncApprovedToActuals(orgId, personId, globalYear, selectedMonth, hoursPerDay, workingDays)
      toast({ title: 'Approved', description: 'Timesheet approved and actuals synced.' })
      loadEnvelopes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (personId: string) => {
    if (!orgId || !user) return
    setActionLoading(true)
    try {
      await timesheetService.updateEnvelopeStatus(orgId, personId, globalYear, selectedMonth, 'Rejected', user.id)
      toast({ title: 'Rejected', description: 'Timesheet rejected.' })
      loadEnvelopes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveAllSubmitted = async () => {
    if (!orgId || !user) return
    const submitted = personEnvelopes.filter(pe => pe.status === 'Submitted')
    if (submitted.length === 0) return
    setActionLoading(true)
    try {
      for (const pe of submitted) {
        await timesheetService.updateEnvelopeStatus(orgId, pe.person.id, globalYear, selectedMonth, 'Approved', user.id)
        await timesheetService.syncApprovedToActuals(orgId, pe.person.id, globalYear, selectedMonth, hoursPerDay, workingDays)
      }
      toast({ title: 'Approved', description: `${submitted.length} timesheets approved and actuals synced.` })
      loadEnvelopes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const prevMonth = () => setSelectedMonth(m => m > 1 ? m - 1 : 12)
  const nextMonth = () => setSelectedMonth(m => m < 12 ? m + 1 : 1)

  const statusFilters: { label: string; value: TimesheetStatus | undefined }[] = [
    { label: `All (${stats.total})`, value: undefined },
    { label: `Submitted (${stats.submitted})`, value: 'Submitted' },
    { label: `Draft (${stats.draft})`, value: 'Draft' },
    { label: `Approved (${stats.approved})`, value: 'Approved' },
    { label: `Rejected (${stats.rejected})`, value: 'Rejected' },
  ]

  const isLoading = loading || staffLoading

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Month</label>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 flex-wrap gap-0.5">
                {MONTHS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMonth(i + 1)}
                    className={cn(
                      'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                      selectedMonth === i + 1
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {stats.submitted > 0 && (
            <Button size="sm" onClick={handleApproveAllSubmitted} disabled={actionLoading} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Approve All Submitted ({stats.submitted})
            </Button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="text-sm font-semibold">{MONTHS[selectedMonth - 1]} {globalYear}</div>
        <div className="flex gap-3 text-xs">
          {stats.submitted > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{stats.submitted} Submitted</span>}
          {stats.approved > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{stats.approved} Approved</span>}
          {stats.draft > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />{stats.draft} Draft</span>}
          {stats.rejected > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{stats.rejected} Rejected</span>}
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
        <SkeletonTable columns={5} rows={6} />
      ) : filteredPersons.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No timesheets found"
          description={statusFilter ? `No ${statusFilter.toLowerCase()} timesheets for this period.` : 'No timesheets yet for this period.'}
        />
      ) : (
        <div className="space-y-2">
          {filteredPersons.map((pe) => {
            const initials = pe.person.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            const pct = maxCapacity > 0 ? Math.round((pe.totalHours / maxCapacity) * 100) : 0
            const isSubmitted = pe.status === 'Submitted'
            const isApproved = pe.status === 'Approved'

            return (
              <div
                key={pe.person.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors border-l-[3px]',
                  STATUS_BORDER[pe.status] ?? 'border-l-transparent',
                  isApproved && 'bg-emerald-50/30 dark:bg-emerald-950/10',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold',
                    isApproved ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400' :
                    isSubmitted ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground',
                  )}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{pe.person.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {pe.totalHours > 0 ? `${pe.totalHours.toFixed(1)}h` : '0h'} / {maxCapacity}h
                      {pe.totalHours > 0 && ` · ${formatPm(hoursToPm(pe.totalHours, workingDays, hoursPerDay))}`}
                      {pe.totalHours > 0 && ` · ${pct}%`}
                    </div>
                  </div>

                  {/* Capacity micro-bar */}
                  {pe.totalHours > 0 && (
                    <div className="hidden sm:flex items-center gap-2 ml-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            pct > 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: status + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={pe.status} />
                  {isSubmitted && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(pe.person.id)}
                        disabled={actionLoading}
                        className="gap-1 text-green-700 hover:text-green-800 hover:bg-green-50 h-7 text-xs"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(pe.person.id)}
                        disabled={actionLoading}
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
