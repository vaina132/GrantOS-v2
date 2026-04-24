import { supabase } from './supabase'
import { queryClient } from './queryClient'

/**
 * Tab-lifecycle rescue — two independent recovery paths:
 *
 *   1. **Tab-event based** (existing): visibilitychange / focus / pageshow
 *      / heartbeat-drift. On wake, proactively refreshSession(); if that
 *      fails, reload.
 *
 *   2. **Watchdog** (new): a 5-second interval that scans every React
 *      Query entry. If any query has been in `fetchStatus: 'fetching'`
 *      state for more than 15 seconds, the client is wedged — we cancel
 *      the stuck queries, refresh auth, and reload if that doesn't clear
 *      them within 5 more seconds. This catches the bug even when NO
 *      browser event fires (the Edge Sleeping-Tabs silent-wake case).
 *
 * All logs use console.log (Chrome/Edge hide console.debug by default).
 */

const VERSION = 'tab-lifecycle v5 (watchdog)'

// Soft rescue: any focus → refresh auth + invalidate queries. Overhead = 1
// API call per focus. Worth it: covers short alt-tabs where auth can still
// go stale.
const AUTH_REFRESH_TIMEOUT_MS = 3_000

// Watchdog thresholds.
const WATCHDOG_INTERVAL_MS = 5_000
const WEDGED_FETCH_THRESHOLD_MS = 15_000 // query stuck fetching this long
const WATCHDOG_GRACE_MS = 5_000 // give auth refresh this long to clear it

// Heartbeat — drift detection for cases where no browser event fires.
const HEARTBEAT_MS = 10_000
const DRIFT_THRESHOLD_MS = 5_000

let inFlight = false
const fetchStartTimes = new Map<string, number>()

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

async function softRescue(reason: string) {
  if (inFlight) return
  inFlight = true
  try {
    console.log(`[tabLifecycle] rescue via ${reason}`)
    const refreshed = await tryRefreshSession(AUTH_REFRESH_TIMEOUT_MS)
    if (!refreshed) {
      console.log('[tabLifecycle] auth refresh failed → reloading')
      window.location.reload()
      return
    }
    queryClient.cancelQueries()
    queryClient.invalidateQueries()
    console.log('[tabLifecycle] queries invalidated after auth refresh')
  } finally {
    inFlight = false
  }
}

/**
 * Watchdog — detects a stuck client by watching for queries that have been
 * in `fetching` state longer than WEDGED_FETCH_THRESHOLD_MS.
 */
function startWatchdog() {
  setInterval(() => {
    const cache = queryClient.getQueryCache()
    const now = Date.now()

    for (const query of cache.getAll()) {
      const key = JSON.stringify(query.queryKey)
      const isFetching = query.state.fetchStatus === 'fetching'

      if (isFetching && !fetchStartTimes.has(key)) {
        fetchStartTimes.set(key, now)
      } else if (!isFetching && fetchStartTimes.has(key)) {
        fetchStartTimes.delete(key)
      }

      const startedAt = fetchStartTimes.get(key)
      if (isFetching && startedAt && now - startedAt > WEDGED_FETCH_THRESHOLD_MS) {
        console.warn(
          `[watchdog] query ${key} has been fetching for ${Math.round((now - startedAt) / 1000)}s — wedged.`,
        )
        // Clear the tracking so we don't loop on the same query.
        fetchStartTimes.delete(key)
        void wedgeRecovery(query.queryKey)
      }
    }
  }, WATCHDOG_INTERVAL_MS)
}

async function wedgeRecovery(queryKey: unknown) {
  console.log('[watchdog] running wedge recovery')
  // Try cancelling the stuck fetches first.
  queryClient.cancelQueries({ queryKey: queryKey as any })

  // Refresh auth. If it also hangs, reload immediately.
  const refreshed = await tryRefreshSession(WATCHDOG_GRACE_MS)
  if (!refreshed) {
    console.warn('[watchdog] auth refresh also wedged → reloading')
    window.location.reload()
    return
  }

  // Auth is alive. Re-run the specific query plus anything else stale.
  queryClient.invalidateQueries()
  console.log('[watchdog] recovered — queries invalidated')
}

let installed = false
export function installTabLifecycle() {
  if (installed || typeof document === 'undefined') return
  installed = true

  console.log(
    `%c[GrantLume] ${VERSION} installed`,
    'color:#0F766E;font-weight:600;background:#F0FDF4;padding:2px 6px;border-radius:4px',
  )

  // Tab-event triggers. Every event → soft rescue (no threshold — the
  // overhead is one ~100ms API call, vs. broken data-load = user rage).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void softRescue('visibilitychange')
    } else {
      console.log('[tabLifecycle] tab hidden')
    }
  })

  window.addEventListener('focus', () => {
    void softRescue('focus')
  })

  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      void softRescue('pageshow-bfcache')
    }
  })

  // Heartbeat drift — catches suspensions that fire no browser event.
  let expectedNext = Date.now() + HEARTBEAT_MS
  const heartbeat = () => {
    const now = Date.now()
    const drift = now - expectedNext
    expectedNext = now + HEARTBEAT_MS
    if (drift > DRIFT_THRESHOLD_MS) {
      console.log(`[tabLifecycle] heartbeat detected ${Math.round(drift / 1000)}s drift — forcing rescue`)
      void softRescue(`heartbeat-drift-${Math.round(drift / 1000)}s`)
    }
    setTimeout(heartbeat, HEARTBEAT_MS)
  }
  setTimeout(heartbeat, HEARTBEAT_MS)

  // Watchdog — the new independent recovery path.
  startWatchdog()
  console.log('[tabLifecycle] watchdog armed (5s interval, 15s wedge threshold)')
}
