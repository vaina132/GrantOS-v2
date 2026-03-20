import { useState, useMemo, useEffect } from 'react'
import { timesheetService, getWorkingDays } from '@/services/timesheetService'
import { useAuthStore } from '@/stores/authStore'
import { logger } from '@/lib/logger'
import { useUiStore } from '@/stores/uiStore'
import { YearSelector } from '@/components/common/YearSelector'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { useTimesheetEnvelopes } from '@/hooks/useTimesheets'
import { settingsService } from '@/services/settingsService'
import { holidayService } from '@/services/holidayService'
import { absenceService } from '@/services/absenceService'
import { generateTimesheetPdf } from '@/services/timesheetPdfExport'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { ClipboardCheck, ChevronLeft, ChevronRight, CheckCircle2, Undo2, Send, PenTool, FileSignature, Clock, FileDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { hoursToPm, formatPm } from '@/lib/pmUtils'
import type { TimesheetEntry, TimesheetStatus, Person, Holiday, Absence } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface PersonSummary {
  person: Person
  envelope: TimesheetEntry | null
  totalHours: number
}

const STATUS_CONFIG: Record<TimesheetStatus, { label: string; color: string; icon: typeof Clock }> = {
  Draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: Clock },
  Submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', icon: Send },
  Signing: { label: 'Signing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: PenTool },
  Signed: { label: 'Signed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: FileSignature },
  Approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2 },
  Rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: Undo2 },
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function AllTimesheets() {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff, isLoading: staffLoading } = useStaff({ is_active: true })
  const { projects: allProjects } = useProjects()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const [orgName, setOrgName] = useState('')
  const [hasDocuSign, setHasDocuSign] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportingAll, setExportingAll] = useState(false)

  const { envelopes, isLoading: envelopesLoading, refetch: refetchEnvelopes } = useTimesheetEnvelopes(selectedMonth)

  // Load org settings + holidays
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      if (org?.working_hours_per_day) setHoursPerDay(org.working_hours_per_day)
      setOrgName(org?.name ?? '')
      setHasDocuSign(!!(org?.docusign_integration_key && org?.docusign_user_id && org?.docusign_account_id && org?.docusign_rsa_private_key))
    }).catch((err) => logger.warn('Failed to load org settings for timesheets', { source: 'AllTimesheets' }, err))
    holidayService.list(orgId, globalYear).then(setHolidays).catch(() => {})
  }, [orgId, globalYear])

  // Build person + envelope pairs
  const personSummaries: PersonSummary[] = useMemo(() => {
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
      }
    }).sort((a, b) => {
      // People with hours first, then alphabetical
      if (a.totalHours > 0 && b.totalHours === 0) return -1
      if (a.totalHours === 0 && b.totalHours > 0) return 1
      return a.person.full_name.localeCompare(b.person.full_name)
    })
  }, [staff, envelopes])

  const workingDays = getWorkingDays(globalYear, selectedMonth)
  const maxCapacity = workingDays * hoursPerDay
  const totalHoursAll = personSummaries.reduce((s, pe) => s + pe.totalHours, 0)
  const peopleWithHours = personSummaries.filter(pe => pe.totalHours > 0).length

  const prevMonth = () => setSelectedMonth(m => m > 1 ? m - 1 : 12)
  const nextMonth = () => setSelectedMonth(m => m < 12 ? m + 1 : 1)

  // Export a single person's timesheet PDF
  const exportPersonPdf = async (person: Person, envelope: TimesheetEntry | null) => {
    if (!orgId) return
    setExportingId(person.id)
    try {
      const [days, personAbsences] = await Promise.all([
        timesheetService.listDays(orgId, person.id, globalYear, selectedMonth),
        absenceService.list(orgId, { person_id: person.id, year: globalYear }),
      ])
      const holidayDates = new Set(holidays.filter(h => {
        const m = parseInt(h.date.split('-')[1], 10)
        return m === selectedMonth
      }).map(h => h.date))
      const absenceDates = new Set<string>(
        personAbsences.flatMap((a: Absence) => {
          const dates: string[] = []
          const start = a.start_date ?? (a as any).date
          const end = a.end_date ?? (a as any).date ?? a.start_date
          if (!start) return dates
          const cursor = new Date(start)
          const endD = new Date(end ?? start)
          while (cursor <= endD) {
            dates.push(toDateStr(cursor))
            cursor.setDate(cursor.getDate() + 1)
          }
          return dates
        })
      )
      generateTimesheetPdf({
        person,
        year: globalYear,
        month: selectedMonth,
        orgName,
        days,
        projects: allProjects,
        envelope,
        hoursPerDay,
        holidays: holidayDates,
        absences: absenceDates,
      })
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : 'Failed to export PDF', variant: 'destructive' })
    } finally {
      setExportingId(null)
    }
  }

  // Batch export all staff with hours
  const exportAllPdfs = async () => {
    if (!orgId) return
    const withHours = personSummaries.filter(pe => pe.totalHours > 0)
    if (withHours.length === 0) {
      toast({ title: 'Nothing to export', description: 'No staff members have timesheet entries this month.' })
      return
    }
    setExportingAll(true)
    let exported = 0
    try {
      for (const pe of withHours) {
        await exportPersonPdf(pe.person, pe.envelope)
        exported++
        // Small delay between downloads to avoid browser blocking
        await new Promise(r => setTimeout(r, 300))
      }
      toast({ title: 'Batch export complete', description: `${exported} timesheet PDF${exported > 1 ? 's' : ''} downloaded.` })
    } catch (err) {
      toast({ title: 'Export error', description: `Exported ${exported} of ${withHours.length}. ${err instanceof Error ? err.message : ''}`, variant: 'destructive' })
    } finally {
      setExportingAll(false)
    }
  }

  const isLoading = envelopesLoading || staffLoading

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Year</label>
          <YearSelector />
        </div>
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

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="text-sm font-semibold">{MONTHS[selectedMonth - 1]} {globalYear}</div>
        <div className="flex items-center gap-4 text-xs">
          <span>{staff.length} staff</span>
          <span>{peopleWithHours} with entries</span>
          <span className="font-semibold">{totalHoursAll.toFixed(1)}h total</span>
          <span className="text-muted-foreground">{formatPm(hoursToPm(totalHoursAll, workingDays, hoursPerDay))}</span>
          {peopleWithHours > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-[11px]"
              disabled={exportingAll}
              onClick={exportAllPdfs}
            >
              {exportingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
              Export All PDFs
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable columns={5} rows={6} />
      ) : personSummaries.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No staff found"
          description="Add active staff members to start tracking timesheets."
        />
      ) : (
        <div className="space-y-2">
          {personSummaries.map((pe) => {
            const pct = maxCapacity > 0 ? Math.round((pe.totalHours / maxCapacity) * 100) : 0
            const hasHours = pe.totalHours > 0

            return (
              <div
                key={pe.person.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors',
                  hasHours ? 'border-l-[3px] border-l-primary' : 'border-l-[3px] border-l-transparent',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <PersonAvatar name={pe.person.full_name} avatarUrl={pe.person.avatar_url} size="md" />

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{pe.person.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {hasHours ? `${pe.totalHours.toFixed(1)}h` : '0h'} / {maxCapacity}h
                      {hasHours && ` · ${formatPm(hoursToPm(pe.totalHours, workingDays, hoursPerDay))}`}
                      {hasHours && ` · ${pct}%`}
                    </div>
                  </div>

                  {/* Capacity micro-bar */}
                  {hasHours && (
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

                {/* Status badge + actions */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const status = pe.envelope?.status ?? 'Draft'
                    const cfg = STATUS_CONFIG[status]
                    const Icon = cfg.icon
                    return (
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', cfg.color)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    )
                  })()}

                  {/* Per-person PDF export */}
                  {hasHours && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-muted-foreground"
                      disabled={exportingId === pe.person.id}
                      onClick={() => exportPersonPdf(pe.person, pe.envelope)}
                    >
                      {exportingId === pe.person.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                      PDF
                    </Button>
                  )}

                  {/* Approve / Reject for Submitted (no DocuSign) or Signed (DocuSign) timesheets */}
                  {(pe.envelope?.status === 'Signed' || (pe.envelope?.status === 'Submitted' && !hasDocuSign)) && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        onClick={async () => {
                          if (!orgId || !user?.id) return
                          try {
                            await timesheetService.updateEnvelopeStatus(orgId, pe.person.id, globalYear, selectedMonth, 'Approved', user.id)
                            toast({ title: 'Approved', description: `${pe.person.full_name}'s timesheet approved.` })
                            await refetchEnvelopes()
                          } catch (err) {
                            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1 text-red-600 border-red-300 hover:bg-red-50"
                        onClick={async () => {
                          if (!orgId || !user?.id) return
                          try {
                            await timesheetService.updateEnvelopeStatus(orgId, pe.person.id, globalYear, selectedMonth, 'Rejected', user.id)
                            toast({ title: 'Rejected', description: `${pe.person.full_name}'s timesheet rejected.` })
                            await refetchEnvelopes()
                          } catch (err) {
                            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
                          }
                        }}
                      >
                        <Undo2 className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
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
