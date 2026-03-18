import { useState, useEffect, useCallback } from 'react'
import { timesheetService } from '@/services/timesheetService'
import { timesheetApproverService } from '@/services/timesheetApproverService'
import { docusignService } from '@/services/docusignService'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useStaff } from '@/hooks/useStaff'
import { YearSelector } from '@/components/common/YearSelector'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { CheckCircle2, XCircle, PenTool, Loader2, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimesheetEntry, Person } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface PendingTimesheet {
  envelope: TimesheetEntry
  person: Person
}

export function ApprovalRequests() {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const { staff } = useStaff({ is_active: true })

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingTimesheet[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [hasDocuSign, setHasDocuSign] = useState(false)
  const [isApprover, setIsApprover] = useState(false)

  // Check if current user is a timesheet approver
  useEffect(() => {
    if (!orgId || !user?.id) return
    timesheetApproverService.getApproverUserIds(orgId).then(ids => {
      setIsApprover(ids.includes(user.id))
    }).catch(() => {})
  }, [orgId, user?.id])

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

      // Build person map
      const personMap = new Map(staff.map(p => [p.id, p]))
      const results: PendingTimesheet[] = []
      for (const env of submitted) {
        const person = personMap.get(env.person_id)
        if (person) {
          results.push({ envelope: env, person })
        }
      }
      setPending(results)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load requests'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear, selectedMonth, staff])

  useEffect(() => { loadPending() }, [loadPending])

  const handleApprove = async (item: PendingTimesheet) => {
    if (!orgId || !user?.id) return
    setProcessingId(item.envelope.id)
    try {
      await timesheetService.updateEnvelopeStatus(
        orgId, item.envelope.person_id, globalYear, selectedMonth, 'Approved', user.id
      )
      toast({ title: 'Approved', description: `${item.person.full_name}'s timesheet approved.` })
      loadPending()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (item: PendingTimesheet) => {
    if (!orgId || !user?.id) return
    const reason = window.prompt('Reason for rejection (optional):')
    if (reason === null) return // cancelled
    setProcessingId(item.envelope.id)
    try {
      await timesheetService.updateEnvelopeStatus(
        orgId, item.envelope.person_id, globalYear, selectedMonth, 'Rejected', user.id
      )
      toast({ title: 'Rejected', description: `${item.person.full_name}'s timesheet rejected.` })
      loadPending()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setProcessingId(null)
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

  if (!isApprover) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Not a timesheet approver"
        description="You are not configured as a timesheet approver. Contact your admin to set up approver permissions in Settings."
      />
    )
  }

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
          icon={CheckCircle2}
          title="All caught up!"
          description={`No timesheets awaiting approval for ${MONTHS[selectedMonth - 1]} ${globalYear}.`}
        />
      ) : (
        <div className="space-y-3">
          {pending.map(item => {
            const isProcessing = processingId === item.envelope.id
            const isSigned = item.envelope.status === 'Signed'

            return (
              <div key={item.envelope.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={item.person.full_name} size="md" />
                    <div>
                      <div className="text-sm font-semibold">{item.person.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.person.department && `${item.person.department} · `}
                        {item.person.role && `${item.person.role} · `}
                        FTE {item.person.fte}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                          item.envelope.status === 'Submitted' && 'bg-blue-100 text-blue-700',
                          item.envelope.status === 'Signed' && 'bg-emerald-100 text-emerald-700',
                        )}>
                          {item.envelope.status}
                        </span>
                        {item.envelope.total_hours != null && (
                          <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                            {item.envelope.total_hours.toFixed(1)}h
                          </span>
                        )}
                        {item.envelope.submitted_at && (
                          <span className="text-[10px] text-muted-foreground">
                            Submitted {new Date(item.envelope.submitted_at).toLocaleDateString('en-GB')}
                          </span>
                        )}
                        {item.envelope.signed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            · Signed {new Date(item.envelope.signed_at).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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

                    {/* Direct approve (no DocuSign, or submitted without signing) */}
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
                          onClick={() => handleReject(item)}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
