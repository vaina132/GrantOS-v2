import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Global keyboard shortcuts:
 *  Escape  — close any open dialog (native browser behavior for dialogs, but also clears focus)
 *  Ctrl+K  — focus search (future) / go to dashboard
 *  Ctrl+Shift+P — go to projects
 *  Ctrl+Shift+S — go to staff
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't intercept if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        // Blur active element (closes dropdowns, deselects)
        ;(document.activeElement as HTMLElement)?.blur?.()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        navigate('/dashboard')
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        navigate('/projects')
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        navigate('/staff')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
