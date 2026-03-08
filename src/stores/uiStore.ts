import { create } from 'zustand'

interface UiState {
  globalYear: number
  sidebarOpen: boolean
  setGlobalYear: (year: number) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  globalYear: new Date().getFullYear(),
  sidebarOpen: true,
  setGlobalYear: (year: number) => set({ globalYear: year }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
}))
