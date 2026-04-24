import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { initSentry } from './lib/sentry'
import { getStripe } from './lib/stripe'
import { queryClient } from './lib/queryClient'
import { installTabLifecycle } from './lib/tabLifecycle'
import App from './App'
import './index.css'
import './lib/i18n'

// Initialize Sentry error tracking (no-op if VITE_SENTRY_DSN not set)
initSentry()

// Pre-warm Stripe.js (no-op if VITE_STRIPE_PUBLISHABLE_KEY not set)
getStripe()

// Recover from Edge Sleeping Tabs / Chrome tab-suspend wedges — probes the
// auth session + invalidates queries when the tab becomes visible again
// after being backgrounded for 30 s or more.
installTabLifecycle()

// Apply dark mode class before first render to avoid flash
const stored = localStorage.getItem('grantlume-dark-mode')
const prefersDark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDark) document.documentElement.classList.add('dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
