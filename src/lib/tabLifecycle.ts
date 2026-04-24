import { supabase } from './supabase'
import { queryClient } from './queryClient'

/**
 * Tab-lifecycle rescue — fixes the Edge "Sleeping Tabs" / Chrome tab-suspend
 * symptom where every query sits on a skeleton placeholder until the user
 * manually refreshes the page.
 *
 * We tried subtle recovery first (probe session → refreshSession → invalidate
 * queries). On Edge with real sleep durations, the Supabase auth lock stays
 * wedged beyond what we can rescue in-process — the only reliable recovery is
 * a real page reload. So now:
 *
 *   - away < SOFT_THRESHOLD_MS → do nothing (quick alt-tabs).
 *   - SOFT_THRESHOLD_MS ≤ away < HARD_THRESHOLD_MS → try the soft rescue
 *     (probe + refresh + invalidate). Recovers a lightly-stale tab in
 *     under a second without losing form state.
 *   - away ≥ HARD_THRESHOLD_MS → reload immediately. Matches what the user
 *     is doing manually today; guarantees fresh state; takes ~1 s.
 *
 * Triggers (all debounced through the same `lastActivity` guard):
 *   - visibilitychange → visible
 *   - window focus (alt-tab where the window isn't fully covered)
 *   - pageshow with persisted=true (bfcache restore)
 *   - heartbeat every 60 s — watches for setTimeout drift, which is the
 *     unambiguous signal that the JS context was suspended and no browser
 *     event is going to fire.
 */

const SOFT_THRESHOLD_MS = 15_000 // below → ignore, above → soft rescue
const HARD_THRESHOLD_MS = 60_000 // above → reload
const SESSION_PROBE_MS = 3_000
const SESSION_REFRESH_MS = 5_000
const HEARTBEAT_MS = 60_000

let lastActivity = typeof document !== 'undefined' ? Date.now() : 0
let inFlight = false

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

async function onWake(reason: string) {
  if (inFlight) return
  const awayMs = Date.now() - lastActivity
  lastActivity = Date.now()
  if (awayMs < SOFT_THRESHOLD_MS) return

  inFlight = true
  try {
    console.debug(
      `[tabLifecycle] wake via ${reason} · away ${Math.round(awayMs / 1000)}s`,
    )

    // Long sleep → don't even try to recover; reload is cheaper than
    // fighting a wedged auth lock, and avoids skeletons-forever.
    if (awayMs >= HARD_THRESHOLD_MS) {
      console.debug('[tabLifecycle] long sleep → reloading')
      window.location.reload()
      return
    }

    // Short-to-medium sleep → probe auth, refresh if needed, invalidate.
    const alive = await probeSession(SESSION_PROBE_MS)
    if (!alive) {
      const refreshed = await tryRefreshSession(SESSION_REFRESH_MS)
      if (!refreshed) {
        console.warn('[tabLifecycle] refreshSession failed → reloading')
        window.location.reload()
        return
      }
    }
    queryClient.cancelQueries()
    queryClient.invalidateQueries()
  } finally {
    inFlight = false
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
      void onWake('visibilitychange')
    }
  })

  window.addEventListener('focus', () => {
    void onWake('focus')
  })
  window.addEventListener('blur', () => {
    lastActivity = Date.now()
  })

  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      void onWake('pageshow-bfcache')
    }
  })

  // setTimeout drift detection — catches Sleeping-Tab wakes that fire
  // none of the browser events above. If we expected the next tick in
  // 60 s and we got it 3 minutes late, the tab was suspended.
  let expectedNext = Date.now() + HEARTBEAT_MS
  const heartbeat = () => {
    const now = Date.now()
    const drift = now - expectedNext
    expectedNext = now + HEARTBEAT_MS
    if (drift > SOFT_THRESHOLD_MS) {
      void onWake(`heartbeat-drift-${Math.round(drift / 1000)}s`)
    }
    setTimeout(heartbeat, HEARTBEAT_MS)
  }
  setTimeout(heartbeat, HEARTBEAT_MS)
}
