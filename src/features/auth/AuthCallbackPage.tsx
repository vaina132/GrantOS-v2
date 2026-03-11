import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

/**
 * Handles Supabase auth redirects:
 * - Email confirmation (PKCE: ?code=..., or token_hash: ?token_hash=...&type=signup)
 * - Implicit flow (#access_token=...)
 * - Magic link login
 * - Password reset redirect
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))

        const code = params.get('code')
        const tokenHash = params.get('token_hash')
        const type = params.get('type')
        const accessToken = hashParams.get('access_token')

        console.log('[AuthCallback] URL:', window.location.href)
        console.log('[AuthCallback] code:', !!code, 'token_hash:', !!tokenHash, 'type:', type, 'hash access_token:', !!accessToken)

        // 1. PKCE flow — ?code=...
        if (code) {
          console.log('[AuthCallback] Exchanging PKCE code...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('[AuthCallback] Code exchange error:', error.message)
            setStatus('error')
            setMessage(error.message)
            return
          }
          if (data.session) {
            console.log('[AuthCallback] Code exchange success, user:', data.session.user.email)
            onSuccess()
            return
          }
        }

        // 2. Token hash flow — ?token_hash=...&type=signup (or type=email)
        if (tokenHash && type) {
          console.log('[AuthCallback] Verifying OTP with token_hash, type:', type)
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'email',
          })
          if (error) {
            console.error('[AuthCallback] verifyOtp error:', error.message)
            setStatus('error')
            setMessage(error.message)
            return
          }
          console.log('[AuthCallback] verifyOtp success')
          onSuccess()
          return
        }

        // 3. Implicit flow — #access_token=... (Supabase JS client auto-processes this)
        if (accessToken) {
          console.log('[AuthCallback] Hash fragment detected, waiting for Supabase to process...')
        }

        // 4. Check if session already exists (hash may have been auto-processed)
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('[AuthCallback] getSession error:', error.message)
          setStatus('error')
          setMessage(error.message)
          return
        }
        if (session) {
          console.log('[AuthCallback] Session found via getSession, user:', session.user.email)
          onSuccess()
          return
        }

        // 5. Wait for auth state change (hash fragment may still be processing)
        console.log('[AuthCallback] No session yet, listening for auth state change...')
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          console.log('[AuthCallback] Auth state changed:', event, !!newSession)
          if (newSession) {
            onSuccess()
            subscription.unsubscribe()
          }
        })

        // Timeout after 10 seconds
        setTimeout(() => {
          setStatus((prev) => {
            if (prev === 'loading') {
              console.error('[AuthCallback] Timed out waiting for session')
              setMessage('Unable to verify your email. The link may have expired or already been used. Please try signing in.')
              subscription.unsubscribe()
              return 'error'
            }
            return prev
          })
        }, 10_000)
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err)
        setStatus('error')
        setMessage('Something went wrong. Please try signing in.')
      }
    }

    const onSuccess = () => {
      setStatus('success')
      setMessage('Your email has been confirmed. Redirecting...')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
    }

    handleCallback()
  }, [navigate])

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
