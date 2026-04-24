import { supabase } from './supabase'
import { queryClient } from './queryClient'

/**
 * Tab-lifecycle handler — rescues the app from the Edge "Sleeping Tabs"
 * wedge where switching away and back leaves queries hanging on skeleton
 * placeholders until the user manually refreshes the page.
 *
 * Sequence on tab becoming visible again after ≥ 30 s:
 *   1. Probe the auth session with a 3 s timeout. If the probe hangs
 *      (the Supabase auth lock is wedged from a dead in-flight request)
 *      we force `refreshSession()`, which restarts the token exchange
 *      on a fresh socket. The `TOKEN_REFRESHED` handler in authStore
 *      then calls `queryClient.invalidateQueries()` — queries re-run.
 *   2. Cancel any React Query fetches that are still marked pending
 *      (their sockets are likely dead after sleep). Cancel unblocks
 *      TanStack Query from waiting on a ghost promise.
 *   3. Invalidate all queries so any mounted useQuery refetches with a
 *      live socket.
 *
 * The 30 s away threshold avoids thundering-herd on quick alt-tabs.
 */

let lastVisible = typeof document !== 'undefined' ? Date.now() : 0

async function probeSession(timeoutMs = 3000): Promise<boolean> {
  return await Promise.race<boolean>([
    supabase.auth
      .getSession()
      .then(({ error }) => !error)
      .catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ])
}

async function onBecomeVisible() {
  const awayMs = Date.now() - lastVisible
  lastVisible = Date.now()
  if (awayMs < 30_000) return

  // Step 1 — is auth alive?
  const alive = await probeSession(3_000)
  if (!alive) {
    // Auth lock or socket is wedged. Force a fresh token exchange.
    try {
      await Promise.race([
        supabase.auth.refreshSession(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('refreshSession timed out')), 5_000),
        ),
      ])
    } catch (err) {
      console.warn('[tabLifecycle] refreshSession failed after tab resume:', err)
      // Give up on recovery — fall through to invalidation so mounted
      // queries at least get a fresh attempt with a 25s fetch timeout.
    }
  }

  // Steps 2 + 3 — cancel pending fetches, invalidate everything so any
  // mounted useQuery triggers a fresh refetch on the next tick.
  queryClient.cancelQueries()
  queryClient.invalidateQueries()
}

/** Attach once at app boot. Idempotent — safe to call twice. */
let installed = false
export function installTabLifecycle() {
  if (installed || typeof document === 'undefined') return
  installed = true

  lastVisible = Date.now()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastVisible = Date.now()
    } else if (document.visibilityState === 'visible') {
      void onBecomeVisible()
    }
  })

  // Edge / Chrome also fire `focus` / `pageshow` on tab resume from sleep.
  // `pageshow` with `event.persisted=true` means the page was restored from
  // the bfcache — we definitely want to refresh data in that case.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      void onBecomeVisible()
    }
  })
}
