import { useState, useEffect } from 'react'
import { absenceService } from '@/services/absenceService'
import { absenceApproverService } from '@/services/absenceApproverService'
import { notificationService } from '@/services/notificationService'
import { emailService } from '@/services/emailService'
import { useAuthStore } from '@/stores/authStore'
import { useAbsences } from '@/hooks/useAbsences'
import { useStaff } from '@/hooks/useStaff'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { Plus, CalendarOff, Trash2, Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { AbsenceConflictPanel } from './AbsenceConflictPanel'
import type { Absence, AbsenceType, AbsenceStatus } from '@/types'

const ABSENCE_TYPES: AbsenceType[] = ['Annual Leave', 'Sick Leave', 'Training', 'Public Holiday', 'Other']

const STATUS_BADGE: Record<AbsenceStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300' },
}

export function AbsenceList() {
  const { orgId, user, can } = useAuthStore()
  const { staff } = useStaff({ is_active: true })
  const [typeFilter, setTypeFilter] = useState<AbsenceType | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<AbsenceStatus | undefined>(undefined)
  const { absences, isLoading, refetch } = useAbsences({ type: typeFilter })
  const [approving, setApproving] = useState<string | null>(null)
  const [hasApprovers, setHasApprovers] = useState(false)

  // Check if org has approvers configured
  useEffect(() => {
    if (!orgId) return
    absenceApproverService.list(orgId).then(a => setHasApprovers(a.length > 0)).catch(() => {})
  }, [orgId])

  // Filter by status client-side
  const filteredAbsences = statusFilter
    ? absences.filter(a => (a as any).status === statusFilter)
    : absences

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Absence | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [personId, setPersonId] = useState('')
  const [absenceType, setAbsenceType] = useState<AbsenceType>('Annual Leave')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState('')
  const [notes, setNotes] = useState('')
  const [substitutePersonId, setSubstitutePersonId] = useState<string | null>(null)
  const [substituteOverlap, setSubstituteOverlap] = useState(false)

  const openCreate = () => {
    setEditTarget(null)
    setPersonId('')
    setAbsenceType('Annual Leave')
    setStartDate('')
    setEndDate('')
    setDays('')
    setNotes('')
    setSubstitutePersonId(null)
    setSubstituteOverlap(false)
    setDialogOpen(true)
  }

  const openEdit = (absence: Absence) => {
    setEditTarget(absence)
    setPersonId(absence.person_id)
    setAbsenceType(absence.type)
    setStartDate(absence.start_date ?? '')
    setEndDate(absence.end_date ?? '')
    setDays(absence.days != null ? String(absence.days) : '')
    setNotes(absence.notes ?? absence.note ?? '')
    setSubstitutePersonId(absence.substitute_person_id ?? null)
    setSubstituteOverlap(false)
    setDialogOpen(true)
  }

  // Check substitute overlap when substitute or dates change
  useEffect(() => {
    if (!substitutePersonId || !startDate || !endDate) {
      setSubstituteOverlap(false)
      return
    }
    absenceService.hasOverlap(substitutePersonId, startDate, endDate)
      .then(setSubstituteOverlap)
      .catch(() => setSubstituteOverlap(false))
  }, [substitutePersonId, startDate, endDate])

  const handleSave = async () => {
    if (!personId || !orgId) return
    setSaving(true)
    try {
      const payload = {
        org_id: orgId,
        person_id: personId,
        type: absenceType,
        start_date: startDate || null,
        end_date: endDate || null,
        days: days ? Number(days) : null,
        date: startDate || null,
        period: null,
        notes: notes || null,
        note: notes || null,
        status: (hasApprovers ? 'pending' : 'approved') as AbsenceStatus,
        requested_by: user?.id ?? null,
        substitute_person_id: substitutePersonId || null,
      }
      if (editTarget) {
        await absenceService.update(editTarget.id, payload)
        toast({ title: 'Updated', description: 'Absence updated.' })
      } else {
        await absenceService.create(payload as any)
        toast({ title: 'Created', description: hasApprovers ? 'Absence request submitted for approval.' : 'Absence recorded.' })

        // Notify approvers if any
        if (hasApprovers && orgId) {
          const personName = staff.find(p => p.id === personId)?.full_name ?? 'A staff member'
          const approverUserIds = await absenceApproverService.getApproverUserIds(orgId)
          if (approverUserIds.length > 0) {
            notificationService.notifyMany({
              orgId,
              userIds: approverUserIds,
              type: 'approval',
              title: 'Absence Request',
              message: `${personName} requested ${absenceType}: ${startDate} – ${endDate ?? startDate} (${days || '?'} days)`,
              link: '/absences',
            }).catch(() => {})
          }
          // Send email to approvers
          const approverEmails = await absenceApproverService.getApproverEmails(orgId)
          for (const approver of approverEmails) {
            emailService.sendAbsenceRequested({
              to: approver.email,
              approverName: approver.name,
              requesterName: personName,
              absenceType,
              startDate: startDate || '',
              endDate: endDate || startDate || '',
              days: days || '?',
              absencesUrl: `${window.location.origin}/absences`,
            }).catch(() => {})
          }
        }
      }
      setDialogOpen(false)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (absence: Absence) => {
    if (!user || !orgId) return
    setApproving(absence.id)
    try {
      await absenceService.approve(absence.id, user.id)
      toast({ title: 'Approved', description: 'Absence request approved.' })
      refetch()

      // Notify the requester
      const personName = (absence as any).persons?.full_name ?? getPersonName(absence.person_id)
      if (absence.requested_by) {
        notificationService.notify({
          orgId,
          userId: absence.requested_by,
          type: 'success',
          title: 'Absence Approved',
          message: `Your absence request for ${personName} (${absence.type}: ${formatDate(absence.start_date)} – ${formatDate(absence.end_date)}) has been approved.`,
          link: '/absences',
        }).catch(() => {})
      }
      // Email the person
      const person = staff.find(p => p.id === absence.person_id)
      if (person?.email) {
        emailService.sendAbsenceApproved({
          to: person.email,
          employeeName: person.full_name,
          absenceType: absence.type,
          startDate: absence.start_date || '',
          endDate: absence.end_date || absence.start_date || '',
          days: String(absence.days ?? ''),
          absencesUrl: `${window.location.origin}/absences`,
        }).catch(() => {})
      }

      // Notify substitute if one was nominated
      if (absence.substitute_person_id) {
        const substitute = staff.find(p => p.id === absence.substitute_person_id)
        const absenteeName = person?.full_name ?? (absence as any).persons?.full_name ?? 'A colleague'
        if (substitute?.email) {
          emailService.sendSubstituteNotification({
            to: substitute.email,
            substituteName: substitute.full_name,
            absenteeName,
            absenceType: absence.type,
            startDate: absence.start_date || '',
            endDate: absence.end_date || absence.start_date || '',
            days: String(absence.days ?? ''),
            absencesUrl: `${window.location.origin}/absences`,
          }).catch(() => {})
        }
        // In-app notification to substitute
        if (substitute?.user_id && orgId) {
          notificationService.notify({
            orgId,
            userId: substitute.user_id,
            type: 'info',
            title: 'Substitute Coverage',
            message: `You have been nominated as substitute for ${absenteeName} (${absence.type}: ${formatDate(absence.start_date)} – ${formatDate(absence.end_date)}).`,
            link: '/absences',
          }).catch(() => {})
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setApproving(null)
    }
  }

  const handleReject = async (absence: Absence) => {
    if (!user || !orgId) return
    setApproving(absence.id)
    try {
      await absenceService.reject(absence.id, user.id)
      toast({ title: 'Rejected', description: 'Absence request rejected.' })
      refetch()

      // Notify the requester
      const personName = (absence as any).persons?.full_name ?? getPersonName(absence.person_id)
      if (absence.requested_by) {
        notificationService.notify({
          orgId,
          userId: absence.requested_by,
          type: 'warning',
          title: 'Absence Rejected',
          message: `Your absence request for ${personName} (${absence.type}: ${formatDate(absence.start_date)} – ${formatDate(absence.end_date)}) has been rejected.`,
          link: '/absences',
        }).catch(() => {})
      }
      // Email the person
      const person = staff.find(p => p.id === absence.person_id)
      if (person?.email) {
        emailService.sendAbsenceRejected({
          to: person.email,
          employeeName: person.full_name,
          absenceType: absence.type,
          startDate: absence.start_date || '',
          endDate: absence.end_date || absence.start_date || '',
          days: String(absence.days ?? ''),
          absencesUrl: `${window.location.origin}/absences`,
        }).catch(() => {})
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setApproving(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const absence = deleteTarget
      const absStatus = (absence as any).status as AbsenceStatus | undefined
      await absenceService.remove(deleteTarget.id)
      toast({ title: 'Deleted', description: 'Absence removed.' })
      setDeleteTarget(null)
      refetch()

      // Fire-and-forget: notify approvers if the absence was pending or approved
      if (orgId && hasApprovers && (absStatus === 'pending' || absStatus === 'approved')) {
        const personName = getPersonName(absence.person_id)
        absenceApproverService.getApproverEmails(orgId).then(approvers => {
          if (approvers.length === 0) return
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.grantlume.com'
          for (const approver of approvers) {
            emailService.sendAbsenceCancelled({
              to: approver.email,
              approverName: approver.name || approver.email.split('@')[0],
              employeeName: personName,
              absenceType: absence.type,
              startDate: absence.start_date ?? '',
              endDate: absence.end_date ?? '',
              days: String(absence.days),
              absencesUrl: `${origin}/absences`,
            }).catch(() => {})
          }
        }).catch(() => {})
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const getPersonName = (pid: string) => {
    const p = staff.find((s) => s.id === pid)
    return p?.full_name ?? '—'
  }

  return (
    <div className="space-y-6">
      {can('canManageAllocations') && (
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Record Absence
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={!typeFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(undefined)}
          >
            All Types
          </Button>
          {ABSENCE_TYPES.map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={!statusFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(undefined)}
          >
            All Status
          </Button>
          {(['pending', 'approved', 'rejected', 'cancelled'] as AbsenceStatus[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable columns={6} rows={6} />
      ) : filteredAbsences.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="No absences recorded"
          description="Record staff absences to track leave and compute available capacity."
          action={
            can('canManageAllocations') ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Record Absence
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Person</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Start</th>
                  <th className="px-4 py-2 text-left font-medium">End</th>
                  <th className="px-4 py-2 text-right font-medium">Days</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Substitute</th>
                  <th className="px-4 py-2 text-left font-medium">Notes</th>
                  {can('canManageAllocations') && (
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAbsences.map((absence) => {
                  const status = ((absence as any).status as AbsenceStatus) || 'approved'
                  const badge = STATUS_BADGE[status]
                  return (
                    <tr key={absence.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">
                        {(absence as any).persons?.full_name ?? getPersonName(absence.person_id)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{absence.type}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(absence.start_date)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(absence.end_date)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{absence.days ?? '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border',
                          badge.className,
                        )}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {absence.substitute_person_id
                          ? (absence.substitute_person?.full_name
                              ?? staff.find(s => s.id === absence.substitute_person_id)?.full_name
                              ?? '—')
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs max-w-[200px] truncate">
                        {absence.notes ?? absence.note ?? '—'}
                      </td>
                      {can('canManageAllocations') && (
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleApprove(absence)}
                                  disabled={approving === absence.id}
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleReject(absence)}
                                  disabled={approving === absence.id}
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(absence)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(absence)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Absence' : 'Record Absence'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Person *</Label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!!editTarget}
              >
                <option value="">Select person...</option>
                {staff.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={absenceType}
                onChange={(e) => setAbsenceType(e.target.value as AbsenceType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ABSENCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days</Label>
              <Input type="number" step="0.5" min="0" value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 5" />
            </div>
            {/* Substitute dropdown */}
            <div className="space-y-2">
              <Label>Substitute <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <select
                value={substitutePersonId ?? ''}
                onChange={(e) => setSubstitutePersonId(e.target.value || null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No substitute</option>
                {staff
                  .filter((p) => p.id !== personId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
              </select>
              {substituteOverlap && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  This person has an approved or pending absence overlapping these dates.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>

            {/* Conflict panel — shows colleagues absent during same period */}
            <AbsenceConflictPanel
              startDate={startDate}
              endDate={endDate}
              excludePersonId={personId || undefined}
              substitutePersonId={substitutePersonId}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !personId}>
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Absence"
        message="Are you sure you want to delete this absence record?"
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
