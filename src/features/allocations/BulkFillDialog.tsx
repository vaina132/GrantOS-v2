import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BulkFillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (pms: number, months: number[]) => void
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function BulkFillDialog({ open, onOpenChange, onApply }: BulkFillDialogProps) {
  const [pms, setPms] = useState('0')
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

  const toggleMonth = (month: number) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month].sort((a, b) => a - b),
    )
  }

  const selectAll = () => setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const selectNone = () => setSelectedMonths([])

  const handleApply = () => {
    const value = Number(pms) || 0
    if (selectedMonths.length === 0) return
    onApply(value, selectedMonths)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Fill Person-Months</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-pms">Person-Months per selected month</Label>
            <Input
              id="bulk-pms"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={pms}
              onChange={(e) => setPms(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Months to fill</Label>
              <div className="flex gap-2">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAll}>
                  All
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectNone}>
                  None
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {MONTH_LABELS.map((label, i) => {
                const month = i + 1
                const selected = selectedMonths.includes(month)
                return (
                  <Button
                    key={month}
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleMonth(month)}
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={selectedMonths.length === 0}>
            Apply to {selectedMonths.length} month{selectedMonths.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
