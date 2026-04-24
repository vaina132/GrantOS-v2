/**
 * Default equality for DraftKeeper — a stringify-based deep compare.
 *
 * JSON.stringify is good enough for form state (POJOs, arrays, primitives).
 * Forms that hold non-serialisable values (Dates, Maps) should supply a
 * custom `equals` via the hook args. The cost of stringify on typical form
 * payloads (a few KB) is negligible compared to the debounce window, and
 * the simplicity is worth it.
 *
 * Caveat: key ordering matters to stringify. Forms that reorder keys
 * between renders would false-positive dirty; in practice React Hook Form
 * and our setState callers never reorder keys, so this has been fine.
 */
export function defaultEquals<T>(a: T, b: T): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    // Circular refs / BigInt — fall back to identity (false).
    return false
  }
}
