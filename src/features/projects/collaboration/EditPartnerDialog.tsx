import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { collabPartnerService } from '@/services/collabProjectService'
import { toast } from '@/components/ui/use-toast'
import type { CollabPartner, CollabPartnerRole, CollabIndirectCostBase } from '@/types'

interface EditPartnerDialogProps {
  partner: CollabPartner | null
  projectId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface PartnerFormState {
  org_name: string
  role: CollabPartnerRole
  participant_number: number
  contact_name: string
  contact_email: string
  country: string
  budget_personnel: number
  budget_subcontracting: number
  budget_travel: number
  budget_equipment: number
  budget_other_goods: number
  total_person_months: number
  funding_rate: number
  indirect_cost_rate: number
  indirect_cost_base: CollabIndirectCostBase
}

const EMPTY: PartnerFormState = {
  org_name: '',
  role: 'partner',
  participant_number: 2,
  contact_name: '',
  contact_email: '',
  country: '',
  budget_personnel: 0,
  budget_subcontracting: 0,
  budget_travel: 0,
  budget_equipment: 0,
  budget_other_goods: 0,
  total_person_months: 0,
  funding_rate: 100,
  indirect_cost_rate: 25,
  indirect_cost_base: 'all_except_subcontracting',
}

export function EditPartnerDialog({ partner, projectId, open, onClose, onSaved }: EditPartnerDialogProps) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const isNew = !partner

  useEffect(() => {
    if (partner) {
      setForm({
        org_name: partner.org_name,
        role: partner.role,
        participant_number: partner.participant_number ?? 2,
        contact_name: partner.contact_name || '',
        contact_email: partner.contact_email || '',
        country: partner.country || '',
        budget_personnel: partner.budget_personnel,
        budget_subcontracting: partner.budget_subcontracting,
        budget_travel: partner.budget_travel,
        budget_equipment: partner.budget_equipment,
        budget_other_goods: partner.budget_other_goods,
        total_person_months: partner.total_person_months,
        funding_rate: partner.funding_rate,
        indirect_cost_rate: partner.indirect_cost_rate,
        indirect_cost_base: partner.indirect_cost_base,
      })
    } else {
      setForm({ ...EMPTY })
    }
  }, [partner, open])

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))
  const setNum = (key: string, value: string) => set(key, value === '' ? 0 : parseFloat(value))

  const handleSave = async () => {
    if (!form.org_name.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        await collabPartnerService.create({
          project_id: projectId,
          org_name: form.org_name.trim(),
          role: form.role as CollabPartnerRole,
          participant_number: form.participant_number ?? undefined,
          contact_name: form.contact_name || undefined,
          contact_email: form.contact_email || undefined,
          budget_personnel: form.budget_personnel,
          budget_subcontracting: form.budget_subcontracting,
          budget_travel: form.budget_travel,
          budget_equipment: form.budget_equipment,
          budget_other_goods: form.budget_other_goods,
          total_person_months: form.total_person_months,
          funding_rate: form.funding_rate,
          indirect_cost_rate: form.indirect_cost_rate,
          indirect_cost_base: form.indirect_cost_base as CollabIndirectCostBase,
        })
        toast({ title: 'Created', description: `${form.org_name} added` })
      } else {
        await collabPartnerService.update(partner!.id, {
          org_name: form.org_name.trim(),
          role: form.role as CollabPartnerRole,
          participant_number: form.participant_number,
          contact_name: form.contact_name || '',
          contact_email: form.contact_email || '',
          country: form.country || '',
          budget_personnel: form.budget_personnel,
          budget_subcontracting: form.budget_subcontracting,
          budget_travel: form.budget_travel,
          budget_equipment: form.budget_equipment,
          budget_other_goods: form.budget_other_goods,
          total_person_months: form.total_person_months,
          funding_rate: form.funding_rate,
          indirect_cost_rate: form.indirect_cost_rate,
          indirect_cost_base: form.indirect_cost_base as CollabIndirectCostBase,
        })
        toast({ title: 'Updated', description: `${form.org_name} saved` })
      }
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Error', description: 'Failed to save partner', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!partner || !confirm(`Remove ${partner.org_name}?`)) return
    try {
      await collabPartnerService.remove(partner.id)
      toast({ title: 'Removed' })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Error', description: 'Failed to remove partner', variant: 'destructive' })
    }
  }

  if (!open) return null

  const totalBudget = form.budget_personnel + form.budget_subcontracting + form.budget_travel + form.budget_equipment + form.budget_other_goods

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-lg font-semibold">{isNew ? 'Add Partner' : `Edit ${partner?.org_name}`}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Organisation Name *</Label>
            <Input value={form.org_name} onChange={e => set('org_name', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="coordinator">Coordinator</option>
              <option value="partner">Partner</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Participant #</Label>
            <Input type="number" value={form.participant_number ?? ''} onChange={e => setNum('participant_number', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Country</Label>
            <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. DE" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Name</Label>
            <Input value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Email</Label>
            <Input type="email" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <hr />

        <div>
          <h3 className="text-sm font-medium mb-3">Budget</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Personnel</Label>
              <Input type="number" value={form.budget_personnel || ''} onChange={e => setNum('budget_personnel', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subcontracting</Label>
              <Input type="number" value={form.budget_subcontracting || ''} onChange={e => setNum('budget_subcontracting', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Travel</Label>
              <Input type="number" value={form.budget_travel || ''} onChange={e => setNum('budget_travel', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Equipment</Label>
              <Input type="number" value={form.budget_equipment || ''} onChange={e => setNum('budget_equipment', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Other Goods</Label>
              <Input type="number" value={form.budget_other_goods || ''} onChange={e => setNum('budget_other_goods', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Total Budget</Label>
              <div className="h-9 flex items-center text-sm font-medium px-3 bg-muted rounded-md">€{totalBudget.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <hr />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Person-Months</Label>
            <Input type="number" step="0.1" value={form.total_person_months || ''} onChange={e => setNum('total_person_months', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Funding Rate %</Label>
            <Input type="number" value={form.funding_rate} onChange={e => setNum('funding_rate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Indirect Cost Rate %</Label>
            <Input type="number" value={form.indirect_cost_rate} onChange={e => setNum('indirect_cost_rate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Indirect Base</Label>
            <select value={form.indirect_cost_base} onChange={e => set('indirect_cost_base', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="all_direct">All Direct Costs</option>
              <option value="personnel_only">Personnel Only</option>
              <option value="all_except_subcontracting">All Except Subcontracting</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {!isNew && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>Remove Partner</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.org_name.trim()}>
              {saving ? 'Saving...' : isNew ? 'Add Partner' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
