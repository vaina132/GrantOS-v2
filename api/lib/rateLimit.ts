import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Simple in-memory sliding-window rate limiter for Vercel serverless.
 *
 * Each serverless instance keeps its own counters (reset on cold start).
 * This stops brute-force / abuse from a single IP within one instance lifetime.
 *
 * For production-grade distributed rate limiting, swap with Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 60 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000)

export interface RateLimitConfig {
  /** Max requests allowed within the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
  /** Identifier prefix to separate different endpoints */
  prefix?: string
}

/**
 * Returns the client IP from common Vercel/proxy headers.
 */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  const real = req.headers['x-real-ip']
  if (typeof real === 'string') return real
  return '0.0.0.0'
}

/**
 * Check rate limit. Returns true if the request is allowed, false if blocked.
 * When blocked, sends a 429 response automatically.
 */
export function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  config: RateLimitConfig,
): boolean {
  const ip = getClientIp(req)
  const prefix = config.prefix || 'global'
  const key = `${prefix}:${ip}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 })
    setRateLimitHeaders(res, config.limit, config.limit - 1, now + config.windowSeconds * 1000)
    return true
  }

  entry.count++

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    setRateLimitHeaders(res, config.limit, 0, entry.resetAt)
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter,
    })
    return false
  }

  setRateLimitHeaders(res, config.limit, config.limit - entry.count, entry.resetAt)
  return true
}

function setRateLimitHeaders(
  res: VercelResponse,
  limit: number,
  remaining: number,
  resetAt: number,
) {
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
}
