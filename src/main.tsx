import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initSentry } from './lib/sentry'
import { getStripe } from './lib/stripe'
import App from './App'
import './index.css'
import './lib/i18n'

// Initialize Sentry error tracking (no-op if VITE_SENTRY_DSN not set)
initSentry()

// Pre-warm Stripe.js (no-op if VITE_STRIPE_PUBLISHABLE_KEY not set)
getStripe()

// Apply dark mode class before first render to avoid flash
const stored = localStorage.getItem('grantlume-dark-mode')
const prefersDark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDark) document.documentElement.classList.add('dark')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute — data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      // Tab returns to GrantLume should NOT trigger a thundering-herd refetch.
      // Chromium throttles background tabs, so a mid-flight query can be
      // paused; when the tab regains focus, refetching everything at once
      // queued behind the auth lock produced the grey-skeleton wedge.
      // Route navigation (refetchOnMount) still refreshes what's needed.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
