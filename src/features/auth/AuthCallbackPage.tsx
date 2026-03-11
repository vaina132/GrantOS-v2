import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

/**
 * Handles Supabase auth redirects:
 * - Email confirmation after signup (PKCE: ?code=... or legacy: ?token_hash=...&type=signup)
 * - Magic link login
 * - OAuth callback
 * - Password reset redirect
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const handleCallback = async () => {
      try {
        // 1. PKCE flow — Supabase sends ?code=... in the query string
        const code = searchParams.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setStatus('error')
            setMessage(error.message)
            return
          }
          if (data.session) {
            onSuccess(data.session)
            return
          }
        }

        // 2. Legacy / implicit flow — token in hash fragment
        //    Supabase JS auto-detects hash fragments on init, so check if session exists
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          setStatus('error')
          setMessage(error.message)
          return
        }

        if (session) {
          onSuccess(session)
          return
        }

        // 3. Still no session — listen for auth state change (hash may still be processing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (newSession) {
            onSuccess(newSession)
            subscription.unsubscribe()
          }
        })

        // Timeout after 10 seconds
        setTimeout(() => {
          setStatus((prev) => {
            if (prev === 'loading') {
              setMessage('Unable to verify your email. The link may have expired or already been used. Please try signing in.')
              subscription.unsubscribe()
              return 'error'
            }
            return prev
          })
        }, 10_000)
      } catch {
        setStatus('error')
        setMessage('Something went wrong. Please try signing in.')
      }
    }

    const onSuccess = (_session: any) => {
      setStatus('success')
      setMessage('Your email has been confirmed. Redirecting...')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
    }

    handleCallback()
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6">
      <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            G
          </div>
          <span className="text-xl font-bold tracking-tight">GrantLume</span>
        </div>

        {status === 'loading' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Verifying...</h2>
            <p className="text-sm text-muted-foreground">Please wait while we confirm your account</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">You're all set!</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Verification failed</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button className="w-full h-11 font-semibold" onClick={() => navigate('/login')}>
              Go to login
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
