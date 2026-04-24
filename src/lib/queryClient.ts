import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton QueryClient.
 *
 * Extracted from main.tsx so the auth store can import it and invalidate
 * caches when Supabase refreshes the token. Without that, any query that
 * 401'd during a token-refresh window stayed wedged: `retry: 1` was spent,
 * `refetchOnWindowFocus: false` meant returning to the tab wouldn't re-run
 * it, and the user was left staring at skeleton placeholders until they
 * hit browser refresh.
 */

/** Error shape produced by Supabase / PostgREST for expired/invalid JWT. */
function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  if (e.status === 401 || e.statusCode === 401) return true
  if (typeof e.code === 'string' && ['PGRST301', '401', 'invalid_jwt'].includes(e.code)) return true
  if (typeof e.message === 'string' && /\bjwt\b|expired|invalid token/i.test(e.message)) return true
  return false
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      // Tab returns to GrantLume should NOT trigger a thundering-herd
      // refetch. Chromium throttles background tabs, so a mid-flight query
      // can be paused; when the tab regains focus, refetching everything
      // at once queued behind the auth lock produced the grey-skeleton
      // wedge. Route navigation (refetchOnMount) still refreshes what's
      // needed, and a TOKEN_REFRESHED handler in authStore.ts now re-runs
      // everything after a token rotation — which was the real cause of
      // the "data never loads until I refresh" reports.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Prevents React Query from pausing queries when the browser thinks
      // it's offline (which happens spuriously after long suspends / sleep
      // / network flaps on some Chromium builds). Supabase's own fetch
      // will reject if there really is no network — that's a retry, not a
      // permanent pause.
      networkMode: 'always',
      // Smart retry: 401 / PGRST301 / JWT-expired errors get retried up to
      // 3 times (giving the auth refresh flow time to deliver a new token
      // via the TOKEN_REFRESHED handler). Every other failure retries once.
      retry: (failureCount, error) => {
        if (isAuthError(error)) return failureCount < 3
        return failureCount < 1
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      networkMode: 'always',
    },
  },
})
