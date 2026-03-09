import { useState, useEffect, useCallback } from 'react'
import { holidayService } from '@/services/holidayService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Holiday } from '@/types'

export function HolidaySettings() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New holiday form
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')

  const loadHolidays = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await holidayService.list(orgId, globalYear)
      setHolidays(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load holidays'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  const handleAdd = async () => {
    if (!orgId || !newDate || !newName.trim()) return
    setSaving(true)
    try {
      await holidayService.create(orgId, newDate, newName.trim())
      setNewDate('')
      setNewName('')
      toast({ title: 'Added', description: 'Holiday added.' })
      loadHolidays()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add holiday'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await holidayService.remove(id)
      toast({ title: 'Removed', description: 'Holiday removed.' })
      loadHolidays()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  // Group holidays by month
  const byMonth: Record<number, Holiday[]> = {}
  for (const h of holidays) {
    const m = new Date(h.date).getMonth()
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(h)
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">National Holidays</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define public/national holidays for your organisation. These dates will be excluded from timesheet entry.
        </p>
      </div>

      {/* Add form */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-[160px]"
            min={`${globalYear}-01-01`}
            max={`${globalYear}-12-31`}
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Holiday Name</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Christmas Day"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
        </div>
        <Button onClick={handleAdd} disabled={saving || !newDate || !newName.trim()} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {saving ? 'Adding...' : 'Add Holiday'}
        </Button>
      </div>

      {/* Holiday list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading holidays...</div>
      ) : holidays.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">No holidays defined for {globalYear}.</div>
          <div className="text-xs text-muted-foreground mt-1">Add national holidays above — they'll be excluded from timesheet working days.</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground font-medium">
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {globalYear}
          </div>

          {Object.keys(byMonth).sort((a, b) => Number(a) - Number(b)).map(monthStr => {
            const monthNum = Number(monthStr)
            const monthHolidays = byMonth[monthNum]
            return (
              <div key={monthNum}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {MONTHS[monthNum]}
                </div>
                <div className="space-y-1">
                  {monthHolidays.map(h => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground w-[80px]">
                          {formatDate(h.date)}
                        </span>
                        <span className="text-sm font-medium">{h.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDelete(h.id)}
                        disabled={deleting === h.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
