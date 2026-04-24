import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DraftConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Apply the local draft to the form state (overwriting what was loaded
   * from the server).
   */
  onRestoreAnyway: () => void
  /**
   * Discard the local draft and keep what the server returned. This is the
   * safe default.
   */
  onKeepServer: () => void
}

/**
 * Shown when a form loads a draft whose `serverLastModified` differs from
 * the server's current mtime — someone else (or the same user on another
 * device) has edited the record. The dialog forces a conscious choice so
 * users can't silently overwrite colleagues' work.
 *
 * We intentionally make "keep server" the quieter default (outline button)
 * and the draft-restore action the louder one — because the user IS in
 * the middle of editing and most likely wants their work. But the title
 * and warning icon make the stakes explicit either way.
 */
export function DraftConflictDialog({
  open,
  onOpenChange,
  onRestoreAnyway,
  onKeepServer,
}: DraftConflictDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} />
            <div className="min-w-0">
              <DialogTitle>{t('draftKeeper.conflict.title')}</DialogTitle>
              <DialogDescription className="mt-1.5">
                {t('draftKeeper.conflict.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onKeepServer}>
            {t('draftKeeper.conflict.keepServer')}
          </Button>
          <Button onClick={onRestoreAnyway}>
            {t('draftKeeper.conflict.restoreAnyway')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
