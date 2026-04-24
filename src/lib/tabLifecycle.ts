import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { flushAllDrafts, pruneExpired } from './draftKeeper'

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

const VERSION = 'tab-lifecycle v6 (watchdog + draftKeeper flush)'

// TTL for stored drafts. Matches the hook default — kept here so the prune
// sweep at install-time doesn't depend on any hook being mounted.
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1_000

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
      console.log('[tabLifecycle] auth refresh failed → flushing drafts then reloading')
      try { flushAllDrafts() } catch { /* best-effort */ }
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
    console.warn('[watchdog] auth refresh also wedged → flushing drafts then reloading')
    try { flushAllDrafts() } catch { /* best-effort */ }
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
      // Tab going background — flush any dirty drafts synchronously before
      // the browser potentially suspends us.
      const flushed = flushAllDrafts()
      if (flushed > 0) console.log(`[tabLifecycle] flushed ${flushed} draft(s) on hide`)
      console.log('[tabLifecycle] tab hidden')
    }
  })

  // pagehide fires even when the page is being discarded (bfcache or real
  // unload). It's the last reliable hook to persist work to localStorage.
  window.addEventListener('pagehide', () => {
    const flushed = flushAllDrafts()
    if (flushed > 0) console.log(`[tabLifecycle] flushed ${flushed} draft(s) on pagehide`)
  })

  // beforeunload is the classic "user is leaving" hook. Modern browsers
  // strip custom messages, but they DO still run synchronous listeners,
  // which is exactly what localStorage.setItem is.
  window.addEventListener('beforeunload', () => {
    flushAllDrafts()
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

  // Drop drafts older than TTL on install. Cheap, runs once, keeps
  // localStorage bounded regardless of how much idle time the user has
  // accumulated between sessions.
  try {
    const pruned = pruneExpired(DRAFT_TTL_MS)
    if (pruned > 0) console.log(`[tabLifecycle] pruned ${pruned} expired draft(s)`)
  } catch (err) {
    console.warn('[tabLifecycle] draft prune failed', err)
  }
}
