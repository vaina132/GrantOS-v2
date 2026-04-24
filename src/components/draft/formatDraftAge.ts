import type { TFunction } from 'i18next'

/**
 * Render a human-friendly relative age ("just now", "3 minutes ago").
 * Returns an empty string if `ageMs` is null/negative.
 *
 * i18next handles EN+DE plural forms via the `_one` / `_other` suffixes
 * defined in the locale files.
 */
export function formatDraftAge(ageMs: number | null, t: TFunction): string {
  if (ageMs == null || ageMs < 0) return ''
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return t('draftKeeper.just')

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('draftKeeper.agoMinutes', { count: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('draftKeeper.agoHours', { count: hours })

  const days = Math.floor(hours / 24)
  return t('draftKeeper.agoDays', { count: days })
}
