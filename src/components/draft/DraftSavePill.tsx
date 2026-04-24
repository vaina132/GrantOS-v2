import { useTranslation } from 'react-i18next'
import { Check, CircleDashed, CircleDot, Loader2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DraftStatus } from '@/lib/draftKeeper'
import { formatDraftAge } from './formatDraftAge'

interface DraftSavePillProps {
  status: DraftStatus
  lastSavedAt: string | null
  className?: string
}

/**
 * Tiny inline status pill. Placed next to a form's "Save" button so users
 * see that their typing is being persisted without any explicit action.
 *
 * Never occupies layout space when `status === 'idle'` — prevents the pill
 * from announcing itself before the user has typed anything.
 */
export function DraftSavePill({ status, lastSavedAt, className }: DraftSavePillProps) {
  const { t } = useTranslation()

  if (status === 'idle') return null

  const ageMs = lastSavedAt ? Date.now() - Date.parse(lastSavedAt) : null
  const agePhrase = formatDraftAge(ageMs, t)

  let label: string
  let Icon: typeof Check = CircleDot
  let tone: string

  switch (status) {
    case 'dirty':
      label = t('draftKeeper.status.dirty')
      Icon = CircleDashed
      tone = 'text-muted-foreground'
      break
    case 'saving':
      label = t('draftKeeper.status.saving')
      Icon = Loader2
      tone = 'text-muted-foreground'
      break
    case 'saved':
      label = agePhrase
        ? t('draftKeeper.status.savedAgo', { time: agePhrase })
        : t('draftKeeper.status.saved')
      Icon = Check
      tone = 'text-emerald-600'
      break
    case 'error':
      label = t('draftKeeper.status.error')
      Icon = TriangleAlert
      tone = 'text-amber-600'
      break
    default:
      return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        tone,
        className,
      )}
      aria-live="polite"
    >
      <Icon
        className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')}
        strokeWidth={2}
      />
      {label}
    </span>
  )
}
