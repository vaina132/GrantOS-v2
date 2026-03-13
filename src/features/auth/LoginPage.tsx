import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { GrantLumeLogo, GrantLumeWordmark } from '@/components/common/GrantLumeLogo'

// ── Rate-limit helpers ──────────────────────────────────
const LOCKOUT_KEY = 'gl_login_attempts'
const MAX_ATTEMPTS_BEFORE_CHALLENGE = 3
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 6
const LOCKOUT_SECONDS = 60

function getAttemptState(): { count: number; lockedUntil: number | null } {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY)
    if (!raw) return { count: 0, lockedUntil: null }
    return JSON.parse(raw)
  } catch { return { count: 0, lockedUntil: null } }
}

function setAttemptState(count: number, lockedUntil: number | null) {
  sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify({ count, lockedUntil }))
}

function clearAttemptState() {
  sessionStorage.removeItem(LOCKOUT_KEY)
}

function generateChallenge(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 20) + 1
  const b = Math.floor(Math.random() * 20) + 1
  return { a, b, answer: a + b }
}

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

  // Rate limiting state
  const [failCount, setFailCount] = useState(() => getAttemptState().count)
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => getAttemptState().lockedUntil)
  const [lockCountdown, setLockCountdown] = useState(0)
  const [challenge, setChallenge] = useState(() => generateChallenge())
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const showChallenge = failCount >= MAX_ATTEMPTS_BEFORE_CHALLENGE
  const isLockedOut = lockedUntil !== null && Date.now() < lockedUntil

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) { setLockCountdown(0); return }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setLockCountdown(remaining)
      if (remaining <= 0) {
        setLockedUntil(null)
        setAttemptState(failCount, null)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [lockedUntil, failCount])

  const recordFailure = useCallback(() => {
    const newCount = failCount + 1
    setFailCount(newCount)
    setChallenge(generateChallenge())
    setChallengeAnswer('')

    if (newCount >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000
      setLockedUntil(until)
      setAttemptState(newCount, until)
    } else {
      setAttemptState(newCount, null)
    }
  }, [failCount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    if (isLockedOut) return

    // Verify challenge if shown
    if (showChallenge && Number(challengeAnswer) !== challenge.answer) {
      toast({ title: 'Incorrect answer', description: 'Please solve the security challenge to continue.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
      clearAttemptState()

      // If "Remember me" is unchecked, mark session for cleanup on tab close
      if (!rememberMe) {
        sessionStorage.setItem('gl_session_ephemeral', '1')
      } else {
        sessionStorage.removeItem('gl_session_ephemeral')
      }

      navigate('/dashboard')
    } catch (err) {
      recordFailure()
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      toast({ title: 'Sign in failed', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — gradient branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md text-white space-y-8">
          <div className="flex items-center gap-3">
            <GrantLumeLogo size={44} variant="dark" />
            <span className="text-2xl font-bold tracking-tight">GrantLume</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Manage your grant projects with confidence
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Track allocations, timesheets, budgets, and reporting — all in one place. Trusted by research organisations across Europe.
          </p>
          <div className="flex flex-col gap-3 text-sm text-blue-100">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-[420px] space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-4">
            <GrantLumeWordmark size={36} variant="color" textClassName="text-xl font-bold tracking-tight" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.welcome')}</h2>
            <p className="text-sm text-muted-foreground">{t('auth.signIn')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
                {t('auth.rememberMe')}
              </Label>
            </div>

            {/* Security challenge after repeated failures */}
            {showChallenge && !isLockedOut && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                  {t('auth.securityCheck')}
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t('auth.solveToProve')}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-amber-900 dark:text-amber-200">
                    {challenge.a} + {challenge.b} =
                  </span>
                  <Input
                    type="number"
                    value={challengeAnswer}
                    onChange={(e) => setChallengeAnswer(e.target.value)}
                    className="w-20 h-9 text-center"
                    placeholder="?"
                  />
                </div>
              </div>
            )}

            {/* Lockout warning */}
            {isLockedOut && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-3 space-y-1">
                <div className="text-sm font-medium text-red-800 dark:text-red-300">
                  Account temporarily locked
                </div>
                <p className="text-xs text-red-700 dark:text-red-400">
                  Too many failed login attempts. Please try again in{' '}
                  <span className="font-bold tabular-nums">{lockCountdown}s</span>.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold text-base" disabled={loading || isLockedOut}>
              {loading ? t('common.loading') : isLockedOut ? `Locked (${lockCountdown}s)` : t('auth.login')}
            </Button>
          </form>

          <Link to="/signup" className="block">
            <Button variant="outline" className="w-full h-11 font-semibold text-base border-primary text-primary hover:bg-primary/5">
              {t('auth.startTrial')}
            </Button>
          </Link>

          <p className="text-center text-xs text-muted-foreground pt-2">
            {t('auth.termsAgree')}{' '}
            <Link to="/terms" className="text-primary hover:underline">{t('auth.termsOfUse')}</Link>
            {' '}{t('common.and')}{' '}
            <Link to="/privacy" className="text-primary hover:underline">{t('auth.privacyPolicy')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
