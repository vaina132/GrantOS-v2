import { Sentry } from '@/lib/sentry'

interface LogContext {
  /** Which module/component/service produced the log */
  source: string
  /** Optional extra data to attach to the Sentry event */
  extra?: Record<string, unknown>
}

/**
 * Structured logger that writes to the console and, for warnings/errors,
 * also reports to Sentry when the DSN is configured.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   somePromise.catch((err) => logger.warn('Failed to load X', { source: 'MyComponent' }, err))
 */
export const logger = {
  info(message: string, ctx?: LogContext) {
    console.info(`[GrantLume] ${ctx?.source ? `[${ctx.source}] ` : ''}${message}`)
  },

  warn(message: string, ctx?: LogContext, error?: unknown) {
    const prefix = `[GrantLume]${ctx?.source ? ` [${ctx.source}]` : ''}`
    console.warn(`${prefix} ${message}`, error ?? '')
    try {
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: { source: ctx?.source },
        extra: { ...ctx?.extra, originalError: error instanceof Error ? error.message : String(error ?? '') },
      })
    } catch {
      // Sentry not initialised — swallow
    }
  },

  error(message: string, ctx?: LogContext, error?: unknown) {
    const prefix = `[GrantLume]${ctx?.source ? ` [${ctx.source}]` : ''}`
    console.error(`${prefix} ${message}`, error ?? '')
    try {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: { source: ctx?.source },
          extra: { ...ctx?.extra, userMessage: message },
        })
      } else {
        Sentry.captureMessage(message, {
          level: 'error',
          tags: { source: ctx?.source },
          extra: { ...ctx?.extra, originalError: String(error ?? '') },
        })
      }
    } catch {
      // Sentry not initialised — swallow
    }
  },
}
