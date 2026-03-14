import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { collabAllocService } from '@/services/collabProjectService'
import { toast } from '@/components/ui/use-toast'
import type { CollabPartner, CollabWorkPackage } from '@/types'

interface AllocRow {
  wp_id: string
  wp_number: number
  wp_title: string
  person_months: number
}

interface EditAllocDialogProps {
  partner: CollabPartner
  wps: CollabWorkPackage[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditAllocDialog({ partner, wps, open, onClose, onSaved }: EditAllocDialogProps) {
  const [rows, setRows] = useState<AllocRow[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const loadAllocs = async () => {
      setLoading(true)
      try {
        const allocs = await collabAllocService.list(partner.id)
        const allocMap = new Map<string, number>()
        for (const a of allocs) {
          allocMap.set(a.wp_id, a.person_months)
        }
        setRows(wps.map(wp => ({
          wp_id: wp.id,
          wp_number: wp.wp_number,
          wp_title: wp.title,
          person_months: allocMap.get(wp.id) ?? 0,
        })))
      } catch {
        toast({ title: 'Error', description: 'Failed to load allocations', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    loadAllocs()
  }, [open, partner.id, wps])

  const updateRow = (idx: number, value: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, person_months: value } : r))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const allocs = rows
        .filter(r => r.person_months > 0)
        .map(r => ({ wp_id: r.wp_id, person_months: r.person_months }))
      await collabAllocService.upsertMany(partner.id, allocs)
      toast({ title: 'Saved', description: `WP allocations for ${partner.org_name} updated` })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Error', description: 'Failed to save allocations', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const totalPMs = rows.reduce((s, r) => s + r.person_months, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-background border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">WP Allocations — {partner.org_name}</h2>
          <p className="text-sm text-muted-foreground">
            Assign person-months per work package (budgeted: {partner.total_person_months} PMs)
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : wps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No work packages defined yet</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[60px_1fr_100px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>WP #</span>
              <span>Title</span>
              <span className="text-right">PMs</span>
            </div>
            {rows.map((row, idx) => (
              <div key={row.wp_id} className="grid grid-cols-[60px_1fr_100px] gap-2 items-center">
                <span className="text-sm font-mono text-center">{row.wp_number}</span>
                <span className="text-sm truncate" title={row.wp_title}>{row.wp_title}</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={row.person_months || ''}
                  onChange={e => updateRow(idx, parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm text-right"
                />
              </div>
            ))}

            <div className="grid grid-cols-[60px_1fr_100px] gap-2 items-center pt-2 border-t">
              <span></span>
              <span className="text-sm font-medium text-right pr-2">Total</span>
              <span className={`text-sm font-medium text-right pr-3 ${
                Math.abs(totalPMs - partner.total_person_months) > 0.1
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {totalPMs.toFixed(1)} / {partner.total_person_months}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Allocations'}
          </Button>
        </div>
      </div>
    </div>
  )
}
