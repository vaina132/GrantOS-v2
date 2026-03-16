import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.category === 'xhr' || b.category === 'fetch') {
            // Remove auth headers from network breadcrumbs
            if (b.data?.url && typeof b.data.url === 'string') {
              try {
                const url = new URL(b.data.url, window.location.origin)
                url.searchParams.delete('apikey')
                b.data.url = url.toString()
              } catch {
                // ignore parse errors
              }
            }
          }
          return b
        })
      }
      return event
    },
  })
}

export { Sentry }
