/**
 * Feature flag — read once on first access and cached for the session.
 *
 * Semantics:
 *   - unset          → enabled (opt-out)
 *   - 'true' / '1'   → enabled
 *   - 'false' / '0'  → disabled
 *
 * Form authors call `isDraftKeeperEnabled()` and feed the result into the
 * hook's `enabled` prop. That keeps DraftKeeper togglable without needing
 * a redeploy of form code.
 */

let cached: boolean | null = null

function parseFlag(raw: string | undefined): boolean {
  if (raw == null || raw === '') return true
  const v = raw.trim().toLowerCase()
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false
  return true
}

export function isDraftKeeperEnabled(): boolean {
  if (cached !== null) return cached
  try {
    cached = parseFlag(import.meta.env.VITE_DRAFT_KEEPER_ENABLED)
  } catch {
    cached = true
  }
  return cached
}

/** Test / dev escape hatch — not used at runtime. */
export function __resetDraftKeeperFlagForTests(): void {
  cached = null
}
