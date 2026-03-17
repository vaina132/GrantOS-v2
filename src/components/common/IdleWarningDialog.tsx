import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Timer } from 'lucide-react'

interface IdleWarningDialogProps {
  open: boolean
  secondsLeft: number
  onStayLoggedIn: () => void
}

export function IdleWarningDialog({ open, secondsLeft, onStayLoggedIn }: IdleWarningDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-amber-500" />
            {t('auth.idleWarningTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            {t('auth.idleWarningDesc', { seconds: secondsLeft })}
          </p>
          <div className="mt-4 flex justify-center">
            <span className="text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {secondsLeft}s
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onStayLoggedIn} className="w-full">
            {t('auth.idleStayLoggedIn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
