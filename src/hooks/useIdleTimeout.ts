import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { writeSecurityAudit } from '@/services/auditWriter'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const WARNING_BEFORE_MS = 60 * 1000     // Show warning 60s before logout

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
]

/**
 * Hook that tracks user activity and triggers auto-logout after idle timeout.
 * Returns { showWarning, secondsLeft, dismissWarning }.
 */
export function useIdleTimeout() {
  const signOut = useAuthStore((s) => s.signOut)
  const user = useAuthStore((s) => s.user)

  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef<number>(0)

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    idleTimerRef.current = null
    warningTimerRef.current = null
    countdownRef.current = null
  }, [])

  const performLogout = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)
    writeSecurityAudit({ action: 'logout', details: 'Auto-logout due to inactivity' })
    signOut()
  }, [clearAllTimers, signOut])

  const resetTimers = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)

    if (!user) return

    // Set warning timer (fires WARNING_BEFORE_MS before logout)
    warningTimerRef.current = setTimeout(() => {
      deadlineRef.current = Date.now() + WARNING_BEFORE_MS
      setShowWarning(true)
      setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000))

      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
        setSecondsLeft(remaining)
        if (remaining <= 0) {
          performLogout()
        }
      }, 1000)
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Set absolute logout timer as a safety net
    idleTimerRef.current = setTimeout(performLogout, IDLE_TIMEOUT_MS)
  }, [clearAllTimers, performLogout, user])

  const dismissWarning = useCallback(() => {
    resetTimers()
  }, [resetTimers])

  useEffect(() => {
    if (!user) {
      clearAllTimers()
      return
    }

    resetTimers()

    const handleActivity = () => {
      // Only reset if warning is NOT showing (user must click "Stay Logged In")
      if (!showWarning) {
        resetTimers()
      }
    }

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true })
    }

    return () => {
      clearAllTimers()
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity)
      }
    }
  }, [user, resetTimers, clearAllTimers, showWarning])

  return { showWarning, secondsLeft, dismissWarning }
}
