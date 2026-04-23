import { create } from 'zustand'

interface UiState {
  globalYear: number
  sidebarOpen: boolean
  darkMode: boolean
  setGlobalYear: (year: number) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleDarkMode: () => void
}

const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('grantlume-dark-mode')
  if (stored !== null) return stored === 'true'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const SIDEBAR_KEY = 'grantlume-sidebar-open'

const getInitialSidebar = (): boolean => {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(SIDEBAR_KEY)
  if (stored !== null) return stored === 'true'
  // First-time default: open on desktop, closed on mobile.
  return window.matchMedia('(min-width: 1024px)').matches
}

const persistSidebar = (open: boolean) => {
  try { localStorage.setItem(SIDEBAR_KEY, String(open)) } catch { /* no-op */ }
}

export const useUiStore = create<UiState>((set) => ({
  globalYear: new Date().getFullYear(),
  sidebarOpen: getInitialSidebar(),
  darkMode: getInitialDarkMode(),
  setGlobalYear: (year: number) => set({ globalYear: year }),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarOpen
      persistSidebar(next)
      return { sidebarOpen: next }
    }),
  setSidebarOpen: (open: boolean) => {
    persistSidebar(open)
    set({ sidebarOpen: open })
  },
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode
      localStorage.setItem('grantlume-dark-mode', String(next))
      document.documentElement.classList.toggle('dark', next)
      return { darkMode: next }
    }),
}))
