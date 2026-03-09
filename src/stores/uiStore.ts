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
  const stored = localStorage.getItem('grantos-dark-mode')
  if (stored !== null) return stored === 'true'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useUiStore = create<UiState>((set) => ({
  globalYear: new Date().getFullYear(),
  sidebarOpen: true,
  darkMode: getInitialDarkMode(),
  setGlobalYear: (year: number) => set({ globalYear: year }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode
      localStorage.setItem('grantos-dark-mode', String(next))
      document.documentElement.classList.toggle('dark', next)
      return { darkMode: next }
    }),
}))
