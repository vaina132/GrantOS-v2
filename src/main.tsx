import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initSentry } from './lib/sentry'
import { initPaddle } from './lib/paddle'
import App from './App'
import './index.css'
import './lib/i18n'

// Initialize Sentry error tracking (no-op if VITE_SENTRY_DSN not set)
initSentry()

// Initialize Paddle billing (no-op if VITE_PADDLE_CLIENT_TOKEN not set)
initPaddle()

// Apply dark mode class before first render to avoid flash
const stored = localStorage.getItem('grantlume-dark-mode')
const prefersDark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDark) document.documentElement.classList.add('dark')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds — keeps cache useful for quick tab switches but refetches reliably on navigation
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: true, // Re-fetch when user tabs back to the app
      refetchOnMount: 'always', // Always refetch when a component mounts (e.g. navigating back to a list)
      retry: 2, // Retry twice on failure (handles transient network/auth errors)
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff: 1s, 2s, 4s…
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
