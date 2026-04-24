import { useTranslation } from 'react-i18next'
import { Clock, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDraftAge } from './formatDraftAge'

interface DraftRestoreBannerProps {
  ageMs: number | null
  onRestore: () => void
  onDiscard: () => void
  onDismiss?: () => void
  className?: string
}

/**
 * Banner shown at the top of a form when a stored draft was found and
 * the form opted NOT to silent-restore (or the silent-restore window had
 * expired). Gives the user three choices: restore, discard, or dismiss
 * (dismiss leaves the draft in storage — useful if the user wants to
 * decide later).
 *
 * Defaults err on the side of *not* overwriting visible content: the
 * caller chooses what the primary button reads and what happens if
 * `onDismiss` is absent.
 */
export function DraftRestoreBanner({
  ageMs,
  onRestore,
  onDiscard,
  onDismiss,
  className,
}: DraftRestoreBannerProps) {
  const { t } = useTranslation()
  const agePhrase = formatDraftAge(ageMs, t)

  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/15',
        className,
      )}
      role="status"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-amber-900 dark:text-amber-200">
          {t('draftKeeper.restore.title')}
        </div>
        <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
          {t('draftKeeper.restore.description', {
            time: agePhrase || t('draftKeeper.just'),
          })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          {t('draftKeeper.restore.discard')}
        </Button>
        <Button size="sm" onClick={onRestore}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          {t('draftKeeper.restore.restore')}
        </Button>
        {onDismiss && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
            onClick={onDismiss}
            aria-label={t('draftKeeper.restore.dismiss')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        )}
      </div>
    </div>
  )
}
