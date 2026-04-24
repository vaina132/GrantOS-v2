import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  /**
   * Months the caller forbids — used by the allocation grid to hide months
   * outside the project's active window. These buttons render disabled
   * and are excluded from both manual toggle and "All".
   */
  disabledMonths?: number[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function BulkFillDialog({ open, onOpenChange, onApply, disabledMonths }: BulkFillDialogProps) {
  const { t } = useTranslation()
  const [pms, setPms] = useState('0')
  const disabledSet = new Set(disabledMonths ?? [])
  const allowedMonths = ALL_MONTHS.filter((m) => !disabledSet.has(m))
  const [selectedMonths, setSelectedMonths] = useState<number[]>(allowedMonths)

  // Reset selection to the currently-allowed months each time the dialog
  // opens — otherwise a prior project's selection (possibly including
  // months now disabled for a different project) leaks into the new session.
  const disabledKey = disabledMonths?.slice().sort((a, b) => a - b).join(',') ?? ''
  useEffect(() => {
    if (open) {
      setSelectedMonths(ALL_MONTHS.filter((m) => !disabledSet.has(m)))
    }
    // We depend on the string-encoded disabled set to avoid effect churn
    // from new array references. disabledSet isn't stable across renders,
    // and listing it directly would trigger every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, disabledKey])

  const toggleMonth = (month: number) => {
    if (disabledSet.has(month)) return
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month].sort((a, b) => a - b),
    )
  }

  const selectAll = () => setSelectedMonths(allowedMonths)
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
          <DialogTitle>{t('allocations.bulkFillPMs')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-pms">{t('allocations.pmsPerMonth')}</Label>
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
              <Label>{t('allocations.monthsToFill')}</Label>
              <div className="flex gap-2">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAll}>
                  {t('common.all')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectNone}>
                  {t('common.none')}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {MONTH_LABELS.map((label, i) => {
                const month = i + 1
                const selected = selectedMonths.includes(month)
                const isDisabled = disabledSet.has(month)
                return (
                  <Button
                    key={month}
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    disabled={isDisabled}
                    onClick={() => toggleMonth(month)}
                    title={isDisabled ? t('allocations.monthOutsideProjectRange', { defaultValue: 'Outside project window' }) : undefined}
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleApply} disabled={selectedMonths.length === 0}>
            {t('allocations.applyToMonths', { count: selectedMonths.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
