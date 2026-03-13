import { useState, useEffect } from 'react'
import { absenceService } from '@/services/absenceService'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, ChevronDown, Users } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Absence, AbsenceStatus } from '@/types'

/** Fallback private types if org settings haven't loaded yet */
const DEFAULT_PRIVATE = ['Sick Leave']

const INITIAL_SHOW = 8

interface AbsenceConflictPanelProps {
  startDate: string
  endDate: string
  /** The person requesting leave — excluded from conflict results */
  excludePersonId?: string
  /** If a substitute is selected, highlight them if they appear in conflicts */
  substitutePersonId?: string | null
}

export function AbsenceConflictPanel({
  startDate,
  endDate,
  excludePersonId,
  substitutePersonId,
}: AbsenceConflictPanelProps) {
  const { orgId } = useAuthStore()
  const [conflicts, setConflicts] = useState<Absence[]>([])
  const [privateTypes, setPrivateTypes] = useState<string[]>(DEFAULT_PRIVATE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Load org-level private absence type config
  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then((org) => {
      if (org?.private_absence_types) setPrivateTypes(org.private_absence_types)
    }).catch(() => {})
  }, [orgId])

  useEffect(() => {
    if (!orgId || !startDate || !endDate) {
      setConflicts([])
      return
    }
    if (startDate > endDate) {
      setConflicts([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    absenceService
      .getConflicts(orgId, startDate, endDate, excludePersonId)
      .then((data) => {
        if (!cancelled) setConflicts(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [orgId, startDate, endDate, excludePersonId])

  // Don't render until both dates are selected
  if (!startDate || !endDate) return null

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Users className="h-3.5 w-3.5 animate-pulse" />
        Checking for overlapping absences…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Could not check for overlapping absences.
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5" />
        No colleagues absent in this period.
      </div>
    )
  }

  const visibleConflicts = showAll ? conflicts : conflicts.slice(0, INITIAL_SHOW)
  const hasMore = conflicts.length > INITIAL_SHOW

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        {conflicts.length} colleague{conflicts.length !== 1 ? 's' : ''} also absent during this period
      </div>

      <div className="space-y-1.5">
        {visibleConflicts.map((c) => {
          const personName = (c as any).persons?.full_name ?? '—'
          const isSubstitute = substitutePersonId && c.person_id === substitutePersonId
          const status = (c.status as AbsenceStatus) || 'approved'
          const isPrivate = privateTypes.includes(c.type)
          const displayType = isPrivate ? 'Absence' : c.type

          return (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                isSubstitute
                  ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800'
                  : 'bg-white/60 dark:bg-white/5',
              )}
            >
              {/* Avatar initials */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                {personName
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{personName}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1.5 py-0',
                      status === 'approved'
                        ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                        : 'border-amber-300 text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {status === 'approved' ? 'Approved' : 'Pending'}
                  </Badge>
                </div>
                <div className="text-muted-foreground">
                  {displayType} · {formatDate(c.start_date)} – {formatDate(c.end_date)}
                </div>
              </div>

              {isSubstitute && (
                <span className="shrink-0 text-[10px] font-semibold text-red-700 dark:text-red-400">
                  ⚠ Your substitute
                </span>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline"
        >
          <ChevronDown className="h-3 w-3" />
          Show {conflicts.length - INITIAL_SHOW} more
        </button>
      )}
    </div>
  )
}
