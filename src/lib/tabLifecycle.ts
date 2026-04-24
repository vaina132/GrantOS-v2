import { supabase } from './supabase'
import { queryClient } from './queryClient'

/**
 * Tab-lifecycle rescue — recovers the app from Edge "Sleeping Tabs" and
 * Chrome tab-suspension wedges where the user returns to the tab and every
 * query hangs on skeleton placeholders until a manual refresh.
 *
 * What actually wedges:
 *   - Edge kills in-flight fetches when a tab sleeps. The JS promises don't
 *     reject — they stay pending. The Supabase auth `processLock` is often
 *     held by one of these dead promises (autoRefreshToken fires every 60s
 *     and can be mid-flight when sleep hits).
 *   - When the tab wakes, any new `getSession()` call waits for the dead
 *     lock. The 25 s fetch timeout in supabase.ts only covers HTTP, not
 *     the lock-acquisition wait itself.
 *
 * Recovery sequence when the tab becomes active after ≥ 30 s away:
 *   1. Probe auth session with a 3 s timeout.
 *   2. If the probe times out, force refreshSession() with a 5 s timeout.
 *   3. If that also fails, **reload the page** — unambiguously recovers
 *      because a fresh page gets a clean client. The user sees a 1-second
 *      flash, not an indefinite skeleton screen.
 *   4. On success, cancel pending queries + invalidate all — any mounted
 *      useQuery refetches with live auth on the next tick.
 *
 * Triggers (all firing the same handler; debounced by `lastVisible`):
 *   - `visibilitychange` → visible  (tab regains visibility)
 *   - `pageshow` with `persisted: true`  (bfcache restore)
 *   - `window.focus`  (Edge/Chrome alt-tab without the window being hidden)
 *   - heartbeat every 90 s while visible — catches wake events that fire
 *     none of the above (rare, but seen on Edge Sleeping Tabs at times).
 */

const SLEEP_THRESHOLD_MS = 30_000
const SESSION_PROBE_MS = 3_000
const SESSION_REFRESH_MS = 5_000
const HEARTBEAT_MS = 90_000

let lastActivity = typeof document !== 'undefined' ? Date.now() : 0
let isRecovering = false

async function probeSession(timeoutMs: number): Promise<boolean> {
  return await Promise.race<boolean>([
    supabase.auth
      .getSession()
      .then(({ error }) => !error)
      .catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ])
}

async function tryRefreshSession(timeoutMs: number): Promise<boolean> {
  try {
    await Promise.race([
      supabase.auth.refreshSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('refreshSession timed out')), timeoutMs),
      ),
    ])
    return true
  } catch {
    return false
  }
}

async function rescueIfWedged(reason: string) {
  if (isRecovering) return
  const awayMs = Date.now() - lastActivity
  lastActivity = Date.now()
  if (awayMs < SLEEP_THRESHOLD_MS) return

  isRecovering = true
  try {
    console.debug(`[tabLifecycle] rescue triggered by ${reason} after ${Math.round(awayMs / 1000)}s`)
    const alive = await probeSession(SESSION_PROBE_MS)
    if (!alive) {
      const refreshed = await tryRefreshSession(SESSION_REFRESH_MS)
      if (!refreshed) {
        // Can't revive the client — a reload unambiguously restores a
        // clean state. User sees a ~1s white flash, which beats the
        // current behaviour (skeleton screens forever until they figure
        // out they need to hit refresh).
        console.warn('[tabLifecycle] Supabase client wedged after sleep; reloading page.')
        window.location.reload()
        return
      }
    }
    // Cancel any stuck-pending fetches and force all mounted useQuery
    // instances to refetch. The new fetches run through the fresh session.
    queryClient.cancelQueries()
    queryClient.invalidateQueries()
  } finally {
    isRecovering = false
  }
}

let installed = false
export function installTabLifecycle() {
  if (installed || typeof document === 'undefined') return
  installed = true

  lastActivity = Date.now()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastActivity = Date.now()
    } else if (document.visibilityState === 'visible') {
      void rescueIfWedged('visibilitychange')
    }
  })

  // Edge + Chrome: alt-tabbing to another window (when it doesn't fully
  // cover this window) doesn't fire visibilitychange — only `focus` fires.
  window.addEventListener('focus', () => {
    void rescueIfWedged('focus')
  })
  window.addEventListener('blur', () => {
    lastActivity = Date.now()
  })

  // BFCache restores after navigation back. Always refresh on these.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      void rescueIfWedged('pageshow-bfcache')
    }
  })

  // Heartbeat: a setTimeout chain that checks wall-clock drift. If the
  // interval fires much later than expected (e.g. 3 min late), the tab
  // was definitely suspended. This catches Sleeping-Tab wakes that don't
  // fire any of the browser events above.
  let expectedNext = Date.now() + HEARTBEAT_MS
  const heartbeat = () => {
    const now = Date.now()
    const drift = now - expectedNext
    expectedNext = now + HEARTBEAT_MS
    if (drift > SLEEP_THRESHOLD_MS) {
      // We were suspended — the scheduler drifted.
      void rescueIfWedged(`heartbeat-drift-${Math.round(drift / 1000)}s`)
    }
    setTimeout(heartbeat, HEARTBEAT_MS)
  }
  setTimeout(heartbeat, HEARTBEAT_MS)
}
