import type { DraftKey } from './types'

/**
 * Key format: `gl.draft.v1:<orgId>:<userId>:<formKey>[:<recordId>]`
 *
 * `orgId` and `userId` come before `formKey` so a sign-out sweep can do a
 * cheap prefix scan over localStorage keys without parsing every entry.
 *
 * Fields containing `:` must be escaped — we URI-encode any colon to
 * keep the split deterministic.
 */

export const KEY_PREFIX = 'gl.draft.v1'

/** Sanitise a field for use inside the colon-delimited key. */
function enc(part: string): string {
  return part.replace(/:/g, '%3A')
}

function dec(part: string): string {
  return part.replace(/%3A/g, ':')
}

/** Build the localStorage key for a given DraftKey. */
export function buildKey(key: DraftKey): string {
  const orgId = key.orgId || '_no-org'
  const userId = key.userId || '_anon'
  const recordId = key.recordId ?? 'new'
  return `${KEY_PREFIX}:${enc(orgId)}:${enc(userId)}:${enc(key.formKey)}:${enc(recordId)}`
}

/**
 * Inverse of buildKey. Returns null if the storage key is not a draft key
 * owned by this module (so callers can skip unrelated localStorage entries).
 */
export function parseKey(storageKey: string): DraftKey | null {
  if (!storageKey.startsWith(KEY_PREFIX + ':')) return null
  const rest = storageKey.slice(KEY_PREFIX.length + 1)
  const parts = rest.split(':')
  // orgId, userId, formKey, recordId
  if (parts.length < 4) return null
  const [orgId, userId, formKey, ...recordParts] = parts
  const recordId = recordParts.join(':')
  return {
    orgId: dec(orgId),
    userId: dec(userId),
    formKey: dec(formKey),
    recordId: dec(recordId),
  }
}

/**
 * Every draft key currently in localStorage. Used by the sign-out sweep and
 * quota eviction path. Returns the raw storage keys so callers can operate
 * directly on them.
 */
export function listAllKeys(): string[] {
  if (typeof localStorage === 'undefined') return []
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(KEY_PREFIX + ':')) out.push(k)
  }
  return out
}

/** Storage keys belonging to a specific (orgId, userId). */
export function listKeysForUser(orgId: string, userId: string): string[] {
  const prefix = `${KEY_PREFIX}:${enc(orgId)}:${enc(userId)}:`
  if (typeof localStorage === 'undefined') return []
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(prefix)) out.push(k)
  }
  return out
}

/** Every draft key belonging to userId, regardless of orgId. */
export function listKeysForUserAllOrgs(userId: string): string[] {
  // Prefix scan can't skip orgId since it varies — we walk all and filter.
  const encoded = enc(userId)
  if (typeof localStorage === 'undefined') return []
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(KEY_PREFIX + ':')) continue
    const parts = k.slice(KEY_PREFIX.length + 1).split(':')
    if (parts.length < 4) continue
    if (parts[1] === encoded) out.push(k)
  }
  return out
}
