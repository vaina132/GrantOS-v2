import { supabase } from './supabase'
import { queryClient } from './queryClient'

/**
 * Tab-lifecycle rescue — fixes Edge "Sleeping Tabs" and Chrome tab-suspend
 * wedges where every query sits on a skeleton placeholder until manual
 * refresh.
 *
 * Strategy:
 *   - away < SOFT_THRESHOLD → ignore (quick alt-tabs)
 *   - SOFT ≤ away < HARD → soft rescue (probe + refresh + invalidate)
 *   - away ≥ HARD → reload immediately (what you'd do manually)
 *
 * Triggers (all debounced through `lastActivity`):
 *   - visibilitychange → visible
 *   - window focus (alt-tab to window that wasn't covering ours)
 *   - pageshow with persisted=true (bfcache restore)
 *   - setTimeout drift heartbeat — unambiguous JS-suspension signal
 *
 * All diagnostics use `console.log` (not `console.debug`) because Chromium
 * DevTools hides `debug` level by default. If you see no logs at all in
 * the console, this file didn't ship — redeploy / hard-refresh.
 */

const VERSION = 'tab-lifecycle v4 (2026-04)'
const SOFT_THRESHOLD_MS = 10_000 // below → ignore
const HARD_THRESHOLD_MS = 30_000 // above → reload
const SESSION_PROBE_MS = 3_000
const SESSION_REFRESH_MS = 5_000
const HEARTBEAT_MS = 30_000

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

  // Log every wake so you can see the handler firing.
  console.log(`[tabLifecycle] wake via ${reason} · away ${Math.round(awayMs / 1000)}s`)

  if (awayMs < SOFT_THRESHOLD_MS) {
    console.log('[tabLifecycle] under 10s — ignoring')
    return
  }

  inFlight = true
  try {
    if (awayMs >= HARD_THRESHOLD_MS) {
      console.log('[tabLifecycle] ≥30s away → reloading page now')
      window.location.reload()
      return
    }

    console.log('[tabLifecycle] soft rescue: probing session')
    const alive = await probeSession(SESSION_PROBE_MS)
    if (!alive) {
      console.log('[tabLifecycle] session probe failed, refreshing')
      const refreshed = await tryRefreshSession(SESSION_REFRESH_MS)
      if (!refreshed) {
        console.log('[tabLifecycle] refresh failed → reloading')
        window.location.reload()
        return
      }
    }
    queryClient.cancelQueries()
    queryClient.invalidateQueries()
    console.log('[tabLifecycle] queries invalidated')
  } finally {
    inFlight = false
  }
}

let installed = false
export function installTabLifecycle() {
  if (installed || typeof document === 'undefined') return
  installed = true

  // Loud, guaranteed-visible install banner. If you don't see this line
  // in the console on page load, this code didn't ship to your browser.
  // Force-refresh (Ctrl+Shift+R) or wait for the Vercel deploy to finish.
  console.log(
    `%c[GrantLume] ${VERSION} installed`,
    'color:#0F766E;font-weight:600;background:#F0FDF4;padding:2px 6px;border-radius:4px',
  )

  lastActivity = Date.now()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastActivity = Date.now()
      console.log('[tabLifecycle] tab hidden — marking away start')
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

  // Heartbeat: if setTimeout drifts significantly, the JS context was
  // suspended. Catches Sleeping-Tab wakes that fire no browser event.
  let expectedNext = Date.now() + HEARTBEAT_MS
  const heartbeat = () => {
    const now = Date.now()
    const drift = now - expectedNext
    expectedNext = now + HEARTBEAT_MS
    if (drift > SOFT_THRESHOLD_MS) {
      console.log(`[tabLifecycle] heartbeat detected ${Math.round(drift / 1000)}s drift`)
      void onWake(`heartbeat-drift-${Math.round(drift / 1000)}s`)
    }
    setTimeout(heartbeat, HEARTBEAT_MS)
  }
  setTimeout(heartbeat, HEARTBEAT_MS)
}
