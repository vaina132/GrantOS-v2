import { createClient, processLock } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// Swap the default `navigatorLock` for `processLock`. The default lock uses
// `navigator.locks`, which Edge/Chromium can leave orphaned when a tab is
// suspended/resumed or when React Strict Mode double-mounts — the observable
// symptom is that every query wedges on a "Lock was not released within
// 5000ms" warning and skeletons never resolve until a full refresh.
// `processLock` is a pure-JS mutex that doesn't depend on navigator.locks.
//
// The `globalThis.__grantos_supabase__` guard prevents Strict Mode from
// creating two clients that would race each other on the same auth token.
declare global {
  // eslint-disable-next-line no-var
  var __grantos_supabase__: ReturnType<typeof createClient<Database>> | undefined
}

/**
 * Every HTTP request made by the Supabase client (DB queries, storage ops,
 * auth refreshes) is wrapped with this fetch to enforce a 25-second timeout.
 *
 * Why: when Edge/Chromium put a tab to sleep (the "Sleeping Tabs" feature),
 * any in-flight fetch can be left in an indeterminate state — the tab wakes,
 * the page thinks the request is still running, but the socket died. Nothing
 * on the React-side ever fires a timeout or retry, so queries sit forever on
 * skeleton placeholders until the user hits browser refresh.
 *
 * This wrapper:
 *   - adds a 25 s cap on every request. If a request hangs longer, it aborts
 *     with a TimeoutError, which bubbles as a rejected promise. React Query's
 *     retry policy (in queryClient.ts) then re-runs the query with a fresh
 *     socket. The UI recovers without a manual refresh.
 *   - respects any caller-provided AbortSignal (e.g. React Query's own
 *     cancellation signal) by chaining it into the combined controller.
 */
const FETCH_TIMEOUT_MS = 25_000

const timeoutFetch: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const callerSignal = init?.signal
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort((callerSignal as AbortSignal & { reason?: unknown }).reason)
    } else {
      callerSignal.addEventListener(
        'abort',
        () => controller.abort((callerSignal as AbortSignal & { reason?: unknown }).reason),
        { once: true },
      )
    }
  }
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException(`Supabase request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, 'TimeoutError'),
    )
  }, FETCH_TIMEOUT_MS)

  const p = fetch(input, { ...init, signal: controller.signal })
  p.finally(() => clearTimeout(timer)).catch(() => {
    /* swallow — caller handles */
  })
  return p
}

export const supabase =
  globalThis.__grantos_supabase__ ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      lock: processLock,
      storageKey: 'grantos-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: timeoutFetch,
    },
  })

if (import.meta.env.DEV) globalThis.__grantos_supabase__ = supabase
