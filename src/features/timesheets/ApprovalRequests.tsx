import { useState, useEffect, useCallback } from 'react'
import { timesheetService } from '@/services/timesheetService'
import { docusignService } from '@/services/docusignService'
import { settingsService } from '@/services/settingsService'
import { notificationService } from '@/services/notificationService'
import { emailService } from '@/services/emailService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { useProjects } from '@/hooks/useProjects'
import { YearSelector } from '@/components/common/YearSelector'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { CheckCircle2, XCircle, PenTool, Loader2, ClipboardCheck, ChevronLeft, ChevronRight, X, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimesheetEntry, TimesheetDay, Person } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface PendingTimesheet {
  envelope: TimesheetEntry
  person: Person
  daysByProject: { acronym: string; hours: number }[]
}

export function ApprovalRequests() {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff } = useStaff({ is_active: true })
  const { projects } = useProjects()

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingTimesheet[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [hasDocuSign, setHasDocuSign] = useState(false)

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<PendingTimesheet | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Check DocuSign config
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then(org => {
      setHasDocuSign(!!(org as any)?.docusign_account_id)
    }).catch(() => {})
  }, [orgId])

  const loadPending = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      // Get all envelopes for the selected month with submitted/signed statuses
      const envelopes = await timesheetService.listEnvelopes(orgId, { year: globalYear, month: selectedMonth })
      const submitted = envelopes.filter(
        (e: TimesheetEntry) => e.status === 'Submitted' || e.status === 'Signed'
      )

      // Build person map and project map
      const personMap = new Map(staff.map(p => [p.id, p]))
      const projectMap = new Map(projects.map(p => [p.id, p]))

      // Load day entries for each submitted person to show distribution
      const results: PendingTimesheet[] = []
      for (const env of submitted) {
        const person = personMap.get(env.person_id)
        if (!person) continue

        let daysByProject: { acronym: string; hours: number }[] = []
        try {
          const days: TimesheetDay[] = await timesheetService.listDays(orgId, env.person_id, globalYear, selectedMonth)
          // Group hours by project
          const byProject = new Map<string, number>()
          for (const d of days) {
            if (d.hours > 0) {
              byProject.set(d.project_id, (byProject.get(d.project_id) ?? 0) + d.hours)
            }
          }
          daysByProject = Array.from(byProject.entries())
            .map(([pid, hours]) => ({
              acronym: projectMap.get(pid)?.acronym ?? '—',
              hours,
            }))
            .sort((a, b) => b.hours - a.hours)
        } catch { /* non-critical */ }

        results.push({ envelope: env, person, daysByProject })
      }
      setPending(results)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load requests'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear, selectedMonth, staff, projects])

  useEffect(() => { loadPending() }, [loadPending])

  const handleApprove = async (item: PendingTimesheet) => {
    if (!orgId || !user?.id) return
    setProcessingId(item.envelope.id)
    try {
      await timesheetService.updateEnvelopeStatus(
        orgId, item.envelope.person_id, globalYear, selectedMonth, 'Approved', user.id
      )

      // Send notification to submitter (fire-and-forget)
      if (item.person.user_id) {
        notificationService.notify({
          orgId,
          userId: item.person.user_id,
          type: 'approval',
          title: 'Timesheet Approved',
          message: `Your timesheet for ${MONTHS[selectedMonth - 1]} ${globalYear} has been approved.`,
          link: '/timesheets',
        }).catch(() => {})
      }

      toast({ title: 'Approved', description: `${item.person.full_name}'s timesheet approved.` })
      loadPending()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectConfirm = async () => {
    if (!orgId || !user?.id || !rejectTarget) return
    setRejecting(true)
    try {
      await timesheetService.updateEnvelopeStatus(
        orgId, rejectTarget.envelope.person_id, globalYear, selectedMonth, 'Rejected', user.id
      )

      const period = `${MONTHS[selectedMonth - 1]} ${globalYear}`
      const noteText = rejectNote.trim()

      // Send in-app notification to submitter
      if (rejectTarget.person.user_id) {
        notificationService.notify({
          orgId,
          userId: rejectTarget.person.user_id,
          type: 'approval',
          title: 'Timesheet Rejected',
          message: `Your timesheet for ${period} was rejected by ${user.email?.split('@')[0] ?? 'an approver'}.${noteText ? ` Reason: ${noteText}` : ' Please review and resubmit.'}`,
          link: '/timesheets',
        }).catch(() => {})
      }

      // Send email notification (fire-and-forget)
      if (rejectTarget.person.email) {
        emailService.sendTimesheetRejected({
          to: rejectTarget.person.email,
          personName: rejectTarget.person.full_name,
          period,
          approverName: user.email?.split('@')[0] ?? 'An approver',
          reason: noteText || undefined,
          timesheetUrl: `${window.location.origin}/timesheets`,
        }).catch(() => {})
      }

      toast({ title: 'Rejected', description: `${rejectTarget.person.full_name}'s timesheet rejected.` })
      setRejectTarget(null)
      setRejectNote('')
      loadPending()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setRejecting(false)
    }
  }

  const handleDocuSign = async (item: PendingTimesheet) => {
    if (!orgId || !user?.id) return
    setProcessingId(item.envelope.id)
    try {
      const result = await docusignService.requestApproverSigning({
        orgId,
        personId: item.envelope.person_id,
        year: globalYear,
        month: selectedMonth,
        approverId: user.id,
      })
      if (result.signingUrl) {
        window.open(result.signingUrl, '_blank')
      }
      toast({ title: 'DocuSign initiated', description: 'Signing ceremony opened in a new tab.' })
      loadPending()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate DocuSign'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setProcessingId(null)
    }
  }

  const prevMonth = () => setSelectedMonth(m => m > 1 ? m - 1 : 12)
  const nextMonth = () => setSelectedMonth(m => m < 12 ? m + 1 : 1)

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <YearSelector />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 gap-0.5 flex-wrap">
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

      {/* Summary */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{MONTHS[selectedMonth - 1]} {globalYear} — Approval Requests</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {pending.length} timesheet{pending.length !== 1 ? 's' : ''} awaiting review
        </span>
      </div>

      {/* List */}
      {loading ? (
        <SkeletonTable columns={5} rows={4} />
      ) : pending.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No pending requests"
          description={`No timesheets are awaiting your approval for ${MONTHS[selectedMonth - 1]} ${globalYear}. You'll see submissions here once your team members submit their timesheets.`}
        />
      ) : (
        <div className="space-y-3">
          {pending.map(item => {
            const isProcessing = processingId === item.envelope.id
            const isSigned = item.envelope.status === 'Signed'
            const totalHours = item.daysByProject.reduce((s, p) => s + p.hours, 0)

            return (
              <div key={item.envelope.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="p-4 space-y-3">
                  {/* Person info + actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <PersonAvatar name={item.person.full_name} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{item.person.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.person.department && `${item.person.department} · `}
                          {item.person.role && `${item.person.role} · `}
                          FTE {item.person.fte}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                            item.envelope.status === 'Submitted' && 'bg-blue-100 text-blue-700',
                            item.envelope.status === 'Signed' && 'bg-emerald-100 text-emerald-700',
                          )}>
                            {item.envelope.status}
                          </span>
                          {totalHours > 0 && (
                            <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                              {totalHours.toFixed(1)}h total
                            </span>
                          )}
                          {item.envelope.submitted_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Submitted {new Date(item.envelope.submitted_at).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* DocuSign for approver (dual signature flow) */}
                      {hasDocuSign && isSigned && (
                        <Button
                          size="sm"
                          onClick={() => handleDocuSign(item)}
                          disabled={isProcessing}
                          className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenTool className="h-3.5 w-3.5" />}
                          Sign & Approve
                        </Button>
                      )}

                      {/* Direct approve/reject */}
                      {(!hasDocuSign || item.envelope.status === 'Submitted') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(item)}
                            disabled={isProcessing}
                            className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          >
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setRejectTarget(item); setRejectNote('') }}
                            disabled={isProcessing}
                            className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Hour distribution by project */}
                  {item.daysByProject.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                      {item.daysByProject.map((p) => (
                        <span
                          key={p.acronym}
                          className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-[11px]"
                        >
                          <span className="font-medium">{p.acronym}</span>
                          <span className="text-muted-foreground tabular-nums">{p.hours.toFixed(1)}h</span>
                          {totalHours > 0 && (
                            <span className="text-muted-foreground/60 tabular-nums">
                              ({Math.round((p.hours / totalHours) * 100)}%)
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectTarget(null)}>
          <div className="bg-background rounded-lg border shadow-lg w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-red-600">Reject Timesheet</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reject {rejectTarget.person.full_name}'s timesheet for {MONTHS[selectedMonth - 1]} {globalYear}
                </p>
              </div>
              <button onClick={() => setRejectTarget(null)} className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Reason for rejection</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Please describe what needs to be corrected (e.g. wrong project hours, missing entries)..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                This note will be sent to {rejectTarget.person.full_name} via notification and email.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={rejecting}
                className="gap-1.5"
              >
                {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                {rejecting ? 'Rejecting...' : 'Reject Timesheet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
