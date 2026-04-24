import { buildKey, listAllKeys, listKeysForUser, listKeysForUserAllOrgs, parseKey } from './key'
import { ageOf, unwrap, wrap } from './envelope'
import type { DraftEnvelope, DraftKey } from './types'

/**
 * localStorage wrapper with graceful degradation: everything is wrapped in
 * try/catch so an embed / private-mode / quota-exceeded browser never
 * crashes the form.
 */

let availableCache: boolean | null = null

/** Detect whether localStorage works (incognito / storage-disabled). */
export function isStorageAvailable(): boolean {
  if (availableCache !== null) return availableCache
  try {
    if (typeof localStorage === 'undefined') {
      availableCache = false
      return false
    }
    const probe = '__gl_draft_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    availableCache = true
    return true
  } catch {
    availableCache = false
    return false
  }
}

/** Read a raw envelope. Returns null on any error. */
export function read<T>(key: DraftKey): DraftEnvelope<T> | null {
  if (!isStorageAvailable()) return null
  try {
    const raw = localStorage.getItem(buildKey(key))
    if (!raw) return null
    return unwrap<T>(raw)
  } catch {
    return null
  }
}

/**
 * Write an envelope. Returns true on success, false on any failure
 * (including QuotaExceededError). The caller surfaces the error via the
 * hook's `lastError`.
 *
 * On quota failure we evict the oldest drafts and retry once.
 */
export function write<T>(
  key: DraftKey,
  payload: T,
  schemaVersion: number,
  serverLastModified: string | null,
): { ok: true } | { ok: false; error: Error } {
  if (!isStorageAvailable()) {
    return { ok: false, error: new Error('localStorage unavailable') }
  }
  const storageKey = buildKey(key)
  const env = wrap(payload, schemaVersion, serverLastModified)
  const json = JSON.stringify(env)
  try {
    localStorage.setItem(storageKey, json)
    return { ok: true }
  } catch (err) {
    // Likely QuotaExceededError — evict oldest drafts and retry once.
    if (evictOldest(5)) {
      try {
        localStorage.setItem(storageKey, json)
        return { ok: true }
      } catch (err2) {
        return { ok: false, error: err2 instanceof Error ? err2 : new Error(String(err2)) }
      }
    }
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/** Delete a single draft. */
export function remove(key: DraftKey): void {
  if (!isStorageAvailable()) return
  try {
    localStorage.removeItem(buildKey(key))
  } catch {
    /* best-effort */
  }
}

/**
 * Evict the N oldest drafts to free quota. Returns true if at least one
 * entry was evicted. Used as a recovery path when the main write path
 * hits QuotaExceededError.
 */
export function evictOldest(n: number): boolean {
  if (!isStorageAvailable()) return false
  const keys = listAllKeys()
  if (keys.length === 0) return false

  // Collect (storageKey, ageMs) pairs.
  const aged: Array<{ k: string; age: number }> = []
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const env = unwrap(raw)
      if (!env) {
        // Unparseable — treat as very old so it gets purged first.
        aged.push({ k, age: Number.MAX_SAFE_INTEGER })
        continue
      }
      aged.push({ k, age: ageOf(env) })
    } catch {
      aged.push({ k, age: Number.MAX_SAFE_INTEGER })
    }
  }
  aged.sort((a, b) => b.age - a.age) // oldest first
  const toEvict = aged.slice(0, Math.max(1, n))
  let evicted = 0
  for (const entry of toEvict) {
    try {
      localStorage.removeItem(entry.k)
      evicted += 1
    } catch {
      /* ignore */
    }
  }
  return evicted > 0
}

/** Purge every draft for a specific user across all orgs. */
export function clearAllDraftsFor(userId: string): number {
  const keys = listKeysForUserAllOrgs(userId)
  let removed = 0
  for (const k of keys) {
    try {
      localStorage.removeItem(k)
      removed += 1
    } catch {
      /* ignore */
    }
  }
  return removed
}

/** Purge every draft in an (orgId, userId) scope. */
export function clearAllDraftsForScope(orgId: string, userId: string): number {
  const keys = listKeysForUser(orgId, userId)
  let removed = 0
  for (const k of keys) {
    try {
      localStorage.removeItem(k)
      removed += 1
    } catch {
      /* ignore */
    }
  }
  return removed
}

/**
 * Walk every draft in storage, dropping any whose envelope is older than
 * `ttlMs`. Cheap housekeeping; safe to call on every sign-in.
 */
export function pruneExpired(ttlMs: number): number {
  if (!isStorageAvailable()) return 0
  const keys = listAllKeys()
  let removed = 0
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const env = unwrap(raw)
      if (!env) {
        // Corrupt — drop it.
        localStorage.removeItem(k)
        removed += 1
        continue
      }
      if (ageOf(env) > ttlMs) {
        localStorage.removeItem(k)
        removed += 1
      }
    } catch {
      /* ignore */
    }
  }
  return removed
}

/**
 * Diagnostic helper — enumerates every draft in storage with its parsed
 * DraftKey. Not used at runtime, but invaluable in the dev console.
 */
export function listAllDrafts(): Array<{ storageKey: string; key: DraftKey | null }> {
  return listAllKeys().map((storageKey) => ({ storageKey, key: parseKey(storageKey) }))
}
