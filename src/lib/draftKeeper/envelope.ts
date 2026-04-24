import type { DraftEnvelope } from './types'

/** Wrap a payload in the on-disk envelope. */
export function wrap<T>(
  payload: T,
  schemaVersion: number,
  serverLastModified: string | null,
): DraftEnvelope<T> {
  return {
    v: 1,
    schemaVersion,
    savedAt: new Date().toISOString(),
    serverLastModified,
    payload,
  }
}

/**
 * Parse a raw JSON string into a DraftEnvelope, validating the minimum
 * shape. Returns null on any parse error — caller discards the draft.
 */
export function unwrap<T>(raw: string): DraftEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const env = parsed as Record<string, unknown>
    if (env.v !== 1) return null
    if (typeof env.schemaVersion !== 'number') return null
    if (typeof env.savedAt !== 'string') return null
    if (env.serverLastModified !== null && typeof env.serverLastModified !== 'string') {
      return null
    }
    if (!('payload' in env)) return null
    return parsed as DraftEnvelope<T>
  } catch {
    return null
  }
}

/** Age of the envelope in ms. */
export function ageOf(env: DraftEnvelope<unknown>): number {
  const saved = Date.parse(env.savedAt)
  if (Number.isNaN(saved)) return Infinity
  return Date.now() - saved
}

/** True if the envelope exceeds `ttlMs`. */
export function isExpired(env: DraftEnvelope<unknown>, ttlMs: number): boolean {
  return ageOf(env) > ttlMs
}
