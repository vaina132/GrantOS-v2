import { supabase } from './supabase'

/**
 * Authenticated fetch wrapper — automatically attaches the current
 * Supabase session JWT as a Bearer token to API requests.
 *
 * Drop-in replacement for `fetch('/api/...')`.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(url, { ...options, headers })
}
