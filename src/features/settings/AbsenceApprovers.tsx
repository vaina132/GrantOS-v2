import { useState, useEffect, useCallback } from 'react'
import { absenceApproverService } from '@/services/absenceApproverService'
import { useAuthStore } from '@/stores/authStore'
import { useStaff } from '@/hooks/useStaff'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, UserCheck, Info } from 'lucide-react'
import type { AbsenceApprover } from '@/types'

export function AbsenceApprovers() {
  const { orgId } = useAuthStore()
  const { staff } = useStaff({ is_active: true })
  const [approvers, setApprovers] = useState<AbsenceApprover[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState('')

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await absenceApproverService.list(orgId)
      setApprovers(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load approvers'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!orgId || !selectedPersonId) return
    setSaving(true)
    try {
      // Try to find the user_id for this person (if they have an account linked by email)
      const person = staff.find(p => p.id === selectedPersonId)
      await absenceApproverService.add(orgId, selectedPersonId, null)
      toast({ title: 'Added', description: `${person?.full_name ?? 'Person'} is now an absence approver.` })
      setSelectedPersonId('')
      load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add approver'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (approver: AbsenceApprover) => {
    try {
      await absenceApproverService.remove(approver.id)
      toast({ title: 'Removed', description: `${approver.person?.full_name ?? 'Approver'} removed.` })
      load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  // Filter out people who are already approvers
  const approverPersonIds = new Set(approvers.map(a => a.person_id))
  const availableStaff = staff.filter(p => !approverPersonIds.has(p.id))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Absence Approvers</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Designate staff members who can approve or reject absence requests.
          When an employee requests time off, all approvers will be notified via in-app notification and email.
        </p>
      </div>

      {/* Info callout */}
      <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-medium">How absence approvals work</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-700 dark:text-blue-400">
            <li>When a staff member's absence is recorded, approvers are notified</li>
            <li>Approvers can approve or reject requests from the Absences page</li>
            <li>The requester receives a notification and email with the decision</li>
            <li>If no approvers are set, absences are auto-approved</li>
          </ul>
        </div>
      </div>

      {/* Add approver */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Staff Member</label>
          <select
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select person...</option>
            {availableStaff.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}{p.role ? ` — ${p.role}` : ''}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleAdd} disabled={saving || !selectedPersonId} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {saving ? 'Adding...' : 'Add Approver'}
        </Button>
      </div>

      {/* Current approvers list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : approvers.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <UserCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">No absence approvers configured.</div>
          <div className="text-xs text-muted-foreground mt-1">
            All absences will be auto-approved until you assign at least one approver.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">
            {approvers.length} approver{approvers.length !== 1 ? 's' : ''}
          </div>
          {approvers.map(approver => (
            <div
              key={approver.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PersonAvatar name={approver.person?.full_name ?? '?'} size="sm" />
                <div>
                  <div className="text-sm font-medium">{approver.person?.full_name ?? 'Unknown'}</div>
                  {(approver.person as any)?.email && (
                    <div className="text-xs text-muted-foreground">{(approver.person as any).email}</div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                onClick={() => handleRemove(approver)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
