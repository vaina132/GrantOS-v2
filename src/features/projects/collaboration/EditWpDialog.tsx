import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { collabWpService } from '@/services/collabProjectService'
import { toast } from '@/components/ui/use-toast'
import type { CollabWorkPackage } from '@/types'

interface WpRow {
  wp_number: number
  title: string
  total_person_months: number
}

interface EditWpDialogProps {
  projectId: string
  existing: CollabWorkPackage[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditWpDialog({ projectId, existing, open, onClose, onSaved }: EditWpDialogProps) {
  const [rows, setRows] = useState<WpRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (existing.length > 0) {
        setRows(existing.map(w => ({
          wp_number: w.wp_number,
          title: w.title,
          total_person_months: w.total_person_months,
        })))
      } else {
        setRows([{ wp_number: 1, title: '', total_person_months: 0 }])
      }
    }
  }, [open, existing])

  const addRow = () => {
    const next = rows.length > 0 ? Math.max(...rows.map(r => r.wp_number)) + 1 : 1
    setRows([...rows, { wp_number: next, title: '', total_person_months: 0 }])
  }

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx))
  }

  const updateRow = (idx: number, field: keyof WpRow, value: any) => {
    setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const handleSave = async () => {
    const valid = rows.filter(r => r.title.trim())
    setSaving(true)
    try {
      await collabWpService.upsertMany(projectId, valid.map(r => ({
        wp_number: r.wp_number,
        title: r.title.trim(),
        total_person_months: r.total_person_months,
      })))
      toast({ title: 'Saved', description: `${valid.length} work package(s) updated` })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Error', description: 'Failed to save work packages', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const totalPMs = rows.reduce((s, r) => s + (r.total_person_months || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Work Packages</h2>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add WP
          </Button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[60px_1fr_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>WP #</span>
            <span>Title</span>
            <span>PMs</span>
            <span></span>
          </div>
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[60px_1fr_120px_40px] gap-2 items-center">
              <Input
                type="number"
                value={row.wp_number}
                onChange={e => updateRow(idx, 'wp_number', parseInt(e.target.value) || 0)}
                className="h-9 text-sm text-center"
              />
              <Input
                value={row.title}
                onChange={e => updateRow(idx, 'title', e.target.value)}
                placeholder="Work package title"
                className="h-9 text-sm"
              />
              <Input
                type="number"
                step="0.1"
                value={row.total_person_months || ''}
                onChange={e => updateRow(idx, 'total_person_months', parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeRow(idx)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}

          {rows.length > 0 && (
            <div className="grid grid-cols-[60px_1fr_120px_40px] gap-2 items-center pt-2 border-t">
              <span></span>
              <span className="text-sm font-medium text-right pr-2">Total</span>
              <span className="text-sm font-medium pl-3">{totalPMs.toFixed(1)}</span>
              <span></span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Work Packages'}
          </Button>
        </div>
      </div>
    </div>
  )
}
