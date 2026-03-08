import { useState } from 'react'
import { absenceService } from '@/services/absenceService'
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
import { Plus, CalendarOff, Trash2, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Absence, AbsenceType } from '@/types'

const ABSENCE_TYPES: AbsenceType[] = ['Annual Leave', 'Sick Leave', 'Training', 'Public Holiday', 'Other']

export function AbsenceList() {
  const { orgId, can } = useAuthStore()
  const { staff } = useStaff({ is_active: true })
  const [typeFilter, setTypeFilter] = useState<AbsenceType | undefined>(undefined)
  const { absences, isLoading, refetch } = useAbsences({ type: typeFilter })

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

  const openCreate = () => {
    setEditTarget(null)
    setPersonId('')
    setAbsenceType('Annual Leave')
    setStartDate('')
    setEndDate('')
    setDays('')
    setNotes('')
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
    setDialogOpen(true)
  }

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
      }
      if (editTarget) {
        await absenceService.update(editTarget.id, payload)
        toast({ title: 'Updated', description: 'Absence updated.' })
      } else {
        await absenceService.create(payload as any)
        toast({ title: 'Created', description: 'Absence recorded.' })
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await absenceService.remove(deleteTarget.id)
      toast({ title: 'Deleted', description: 'Absence removed.' })
      setDeleteTarget(null)
      refetch()
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

      {isLoading ? (
        <SkeletonTable columns={6} rows={6} />
      ) : absences.length === 0 ? (
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
                  <th className="px-4 py-2 text-left font-medium">Notes</th>
                  {can('canManageAllocations') && (
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {absences.map((absence) => (
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
                    <td className="px-4 py-2 text-muted-foreground text-xs max-w-[200px] truncate">
                      {absence.notes ?? absence.note ?? '—'}
                    </td>
                    {can('canManageAllocations') && (
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(absence)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(absence)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
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
