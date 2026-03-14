import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { collabProjectService } from '@/services/collabProjectService'
import { toast } from '@/components/ui/use-toast'
import type { CollabProject } from '@/types'

interface EditProjectDialogProps {
  project: CollabProject | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditProjectDialog({ project, open, onClose, onSaved }: EditProjectDialogProps) {
  const [form, setForm] = useState({
    title: '',
    acronym: '',
    grant_number: '',
    funding_programme: '',
    funding_scheme: '',
    start_date: '',
    end_date: '',
    duration_months: '',
    deviation_personnel_effort: '',
    deviation_personnel_costs: '',
    deviation_pm_rate: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project && open) {
      setForm({
        title: project.title,
        acronym: project.acronym,
        grant_number: project.grant_number || '',
        funding_programme: project.funding_programme || '',
        funding_scheme: project.funding_scheme || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        duration_months: project.duration_months != null ? String(project.duration_months) : '',
        deviation_personnel_effort: String(project.deviation_personnel_effort ?? 0),
        deviation_personnel_costs: String(project.deviation_personnel_costs ?? 0),
        deviation_pm_rate: String(project.deviation_pm_rate ?? 0),
      })
    }
  }, [project, open])

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!project || !form.title.trim() || !form.acronym.trim()) return
    setSaving(true)
    try {
      await collabProjectService.update(project.id, {
        title: form.title.trim(),
        acronym: form.acronym.trim(),
        grant_number: form.grant_number || null,
        funding_programme: form.funding_programme || null,
        funding_scheme: form.funding_scheme || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        duration_months: form.duration_months ? parseInt(form.duration_months) : null,
        deviation_personnel_effort: parseFloat(form.deviation_personnel_effort) || 0,
        deviation_personnel_costs: parseFloat(form.deviation_personnel_costs) || 0,
        deviation_pm_rate: parseFloat(form.deviation_pm_rate) || 0,
      })
      toast({ title: 'Updated', description: 'Project details saved' })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Error', description: 'Failed to update project', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!open || !project) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-lg font-semibold">Edit Project Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Acronym *</Label>
            <Input value={form.acronym} onChange={e => set('acronym', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Grant Agreement Number</Label>
            <Input value={form.grant_number} onChange={e => set('grant_number', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Funding Programme</Label>
            <Input value={form.funding_programme} onChange={e => set('funding_programme', e.target.value)} placeholder="e.g. Horizon Europe" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Funding Scheme</Label>
            <Input value={form.funding_scheme} onChange={e => set('funding_scheme', e.target.value)} placeholder="e.g. RIA, IA, CSA" className="h-9 text-sm" />
          </div>
        </div>

        <hr />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duration (months)</Label>
            <Input type="number" value={form.duration_months} onChange={e => set('duration_months', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <hr />

        <div>
          <h3 className="text-sm font-medium mb-3">Deviation Thresholds (%)</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Maximum allowed deviation before a justification is required from partners.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Personnel Effort</Label>
              <Input type="number" value={form.deviation_personnel_effort} onChange={e => set('deviation_personnel_effort', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Personnel Costs</Label>
              <Input type="number" value={form.deviation_personnel_costs} onChange={e => set('deviation_personnel_costs', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PM Rate</Label>
              <Input type="number" value={form.deviation_pm_rate} onChange={e => set('deviation_pm_rate', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.acronym.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
