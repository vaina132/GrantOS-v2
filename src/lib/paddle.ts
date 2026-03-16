/**
 * Paddle.js initialization
 *
 * Paddle.js is loaded via script tag in index.html.
 * This module initializes it with the client-side token once available.
 *
 * Required env var: VITE_PADDLE_CLIENT_TOKEN
 * Optional env var: VITE_PADDLE_ENVIRONMENT ('sandbox' | 'production')
 */

let initialized = false

export function initPaddle(): void {
  if (initialized) return

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN
  if (!token) {
    // Paddle not configured — skip silently
    return
  }

  const Paddle = (window as any).Paddle
  if (!Paddle) {
    // Script not loaded yet — retry after a short delay
    setTimeout(initPaddle, 2000)
    return
  }

  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'sandbox'

  Paddle.Initialize({
    token,
    environment,
  })

  initialized = true
  console.log(`[GrantLume] Paddle initialized (${environment})`)
}
