import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildKey } from './key'
import { ageOf, isExpired } from './envelope'
import { read, remove, write } from './storage'
import { register, unregister } from './registry'
import { defaultEquals } from './equality'
import { isDraftKeeperEnabled } from './flag'
import type {
  DraftConflict,
  DraftStatus,
  UseDraftKeeperArgs,
  UseDraftKeeperResult,
} from './types'

const DEFAULT_DEBOUNCE_MS = 1_500
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1_000 // 30 days

/**
 * useDraftKeeper — the hook every form uses to get autosave + recovery.
 *
 * Lifecycle:
 *   1. On mount, read any existing envelope from localStorage.
 *      - If expired, migration-failed, or wrong-user-scope → discard.
 *      - If draft matches current value → discard (nothing to recover).
 *      - If draft is fresh AND no conflict AND silentRestoreWindowMs
 *        window, silently apply it via `setValue`.
 *      - Otherwise → expose `hasDraft`, `draftPayload`, and the form shows
 *        a restore banner.
 *
 *   2. While mounted, every change to `value` schedules a debounced write.
 *      Writing is async via timer; `flushNow()` and the registry can
 *      force a synchronous write.
 *
 *   3. On unmount, we unregister and stop any pending timer. We do NOT
 *      flush on unmount — unmount-time flushing caused a lost-work bug
 *      when React Strict Mode double-mounted forms in dev.
 *
 *   4. External events (tab-lifecycle, beforeunload, sign-out) reach us
 *      via the registry, not via unmount.
 */
export function useDraftKeeper<T>(args: UseDraftKeeperArgs<T>): UseDraftKeeperResult<T> {
  // Global kill-switch: if the feature flag is off, every instance is a
  // no-op regardless of what the caller passed for `enabled`.
  const globallyEnabled = isDraftKeeperEnabled()

  const {
    key,
    value,
    setValue,
    enabled: enabledArg = true,
    serverLastModified = null,
    schemaVersion = 1,
    migrate,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    ttlMs = DEFAULT_TTL_MS,
    equals = defaultEquals,
    silentRestoreWindowMs = 0,
    baseline = null,
  } = args

  const enabled = enabledArg && globallyEnabled

  // Stable key string — used to reset state when any scope field changes.
  const keyStr = useMemo(() => buildKey(key), [key.orgId, key.userId, key.formKey, key.recordId])

  const [status, setStatus] = useState<DraftStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftAge, setDraftAge] = useState<number | null>(null)
  const [draftPayload, setDraftPayload] = useState<T | null>(null)
  const [conflict, setConflict] = useState<DraftConflict | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)

  // Refs — we need stable handles inside timers and the registry entry.
  const valueRef = useRef(value)
  valueRef.current = value
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const serverMtimeRef = useRef(serverLastModified)
  serverMtimeRef.current = serverLastModified
  const baselineRef = useRef<T | null>(baseline)
  baselineRef.current = baseline
  const equalsRef = useRef(equals)
  equalsRef.current = equals
  const lastWrittenRef = useRef<T | null>(null)
  const debounceTimerRef = useRef<number | null>(null)

  // ----- Mount: load existing draft -----
  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setHasDraft(false)
      setDraftPayload(null)
      setDraftAge(null)
      setConflict(null)
      return
    }

    const env = read<T>(key)
    if (!env) {
      lastWrittenRef.current = null
      setHasDraft(false)
      setDraftPayload(null)
      setDraftAge(null)
      setConflict(null)
      setStatus('idle')
      return
    }

    // Expired → discard immediately.
    if (isExpired(env, ttlMs)) {
      remove(key)
      lastWrittenRef.current = null
      setStatus('idle')
      return
    }

    // Schema drift → try to migrate, else discard.
    let payload = env.payload
    if (env.schemaVersion !== schemaVersion) {
      if (!migrate) {
        remove(key)
        lastWrittenRef.current = null
        setStatus('idle')
        return
      }
      const migrated = migrate(env.payload, env.schemaVersion, schemaVersion)
      if (migrated == null) {
        remove(key)
        lastWrittenRef.current = null
        setStatus('idle')
        return
      }
      payload = migrated
    }

    lastWrittenRef.current = payload

    // If draft matches current value exactly, nothing to recover.
    if (equalsRef.current(payload, valueRef.current)) {
      setHasDraft(false)
      setDraftPayload(null)
      setDraftAge(null)
      setConflict(null)
      setStatus('saved')
      setLastSavedAt(env.savedAt)
      return
    }

    // Conflict detection: draft's view of server mtime vs current.
    const conflictInfo: DraftConflict | null =
      env.serverLastModified !== serverLastModified
        ? {
            draftServerLastModified: env.serverLastModified,
            currentServerLastModified: serverLastModified,
          }
        : null

    const ageMs = ageOf(env)

    // Silent rehydrate window — only when no conflict, and within window.
    if (
      silentRestoreWindowMs > 0 &&
      !conflictInfo &&
      ageMs <= silentRestoreWindowMs
    ) {
      setValue(payload)
      setHasDraft(false)
      setDraftPayload(null)
      setDraftAge(null)
      setConflict(null)
      setStatus('saved')
      setLastSavedAt(env.savedAt)
      return
    }

    setHasDraft(true)
    setDraftPayload(payload)
    setDraftAge(ageMs)
    setConflict(conflictInfo)
    setStatus('saved')
    setLastSavedAt(env.savedAt)
    // We intentionally only run this effect when the key changes — not on
    // every value change. Mount-time recovery only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, enabled])

  // ----- Write path -----
  const doWrite = useCallback(
    (next: T) => {
      if (!enabledRef.current) return
      setStatus('saving')
      const result = write(key, next, schemaVersion, serverMtimeRef.current ?? null)
      if (result.ok) {
        lastWrittenRef.current = next
        const now = new Date().toISOString()
        setLastSavedAt(now)
        setLastError(null)
        setStatus('saved')
      } else {
        setLastError(result.error)
        setStatus('error')
      }
    },
    [key, keyStr, schemaVersion],
  )

  const doClear = useCallback(() => {
    remove(key)
    lastWrittenRef.current = null
    setLastSavedAt(null)
    setStatus('idle')
  }, [key, keyStr])

  // ----- Value-change effect: schedule debounced writes -----
  useEffect(() => {
    if (!enabled) return

    // If baseline is provided and value matches it, clear any draft and
    // mark idle — the user has reverted to the server state.
    if (
      baselineRef.current != null &&
      equalsRef.current(value, baselineRef.current)
    ) {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (lastWrittenRef.current != null) {
        doClear()
      } else {
        setStatus('idle')
      }
      return
    }

    // If value matches what we last wrote, nothing to do.
    if (
      lastWrittenRef.current != null &&
      equalsRef.current(value, lastWrittenRef.current)
    ) {
      return
    }

    setStatus('dirty')

    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      doWrite(valueRef.current)
    }, debounceMs)

    return () => {
      // Cleanup only clears the pending timer — it does NOT flush. Flushing
      // on cleanup (which runs on every value change in React) would write
      // on every keystroke.
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [value, enabled, debounceMs, doWrite, doClear])

  // ----- Registry: expose flushSync + clear to tab-lifecycle / sign-out -----
  useEffect(() => {
    if (!enabled) return undefined

    const handle = register({
      key,
      isDirty: () => {
        const lastWritten = lastWrittenRef.current
        if (
          baselineRef.current != null &&
          equalsRef.current(valueRef.current, baselineRef.current)
        ) {
          return false
        }
        if (lastWritten == null) {
          // No prior write; consider dirty iff there's a baseline diff, else
          // assume a form with no baseline is dirty whenever it has content.
          return true
        }
        return !equalsRef.current(valueRef.current, lastWritten)
      },
      flushSync: () => {
        if (debounceTimerRef.current != null) {
          window.clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        doWrite(valueRef.current)
      },
      clear: () => {
        if (debounceTimerRef.current != null) {
          window.clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        doClear()
      },
    })
    return () => unregister(handle.id)
  }, [enabled, keyStr, doWrite, doClear, key])

  // ----- Public API -----
  const restore = useCallback(() => {
    if (draftPayload != null) {
      setValue(draftPayload)
    }
    setHasDraft(false)
    setDraftPayload(null)
    setDraftAge(null)
    setConflict(null)
  }, [draftPayload, setValue])

  const discard = useCallback(() => {
    doClear()
    setHasDraft(false)
    setDraftPayload(null)
    setDraftAge(null)
    setConflict(null)
  }, [doClear])

  const flushNow = useCallback(async () => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    doWrite(valueRef.current)
  }, [doWrite])

  const isDirty = useMemo(() => {
    if (!enabled) return false
    const lw = lastWrittenRef.current
    if (lw != null) return !equals(value, lw)
    const baselineVal = baselineRef.current
    if (baselineVal != null) return !equals(value, baselineVal)
    // No prior write, no baseline — conservatively report not-dirty so an
    // untouched empty form doesn't show an "unsaved" pill. External
    // flushSync() still writes if invoked.
    return false
  }, [value, enabled, equals])

  return {
    status,
    lastSavedAt,
    hasDraft,
    draftAge,
    conflict,
    draftPayload,
    restore,
    discard,
    flushNow,
    isDirty,
    lastError,
  }
}
