import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { emailService } from '@/services/emailService'

/**
 * Handles Supabase auth redirects:
 * - Email confirmation after signup
 * - Magic link login
 * - OAuth callback (Google, Microsoft, Slack)
 * Supabase appends #access_token=...&type=... to the URL
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
        // Supabase JS client auto-parses the hash fragment and establishes a session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          setStatus('error')
          setMessage(error.message)
          return
        }

        if (session) {
          onSuccess(session)
        } else {
          // No session yet — the auth state change listener might handle it
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              onSuccess(session)
              subscription.unsubscribe()
            }
          })

          // Timeout after 5 seconds
          setTimeout(() => {
            setStatus((prev) => {
              if (prev === 'loading') {
                setMessage('Unable to verify your email. The link may have expired. Please try signing in.')
                subscription.unsubscribe()
                return 'error'
              }
              return prev
            })
          }, 5000)
        }
      } catch {
        setStatus('error')
        setMessage('Something went wrong. Please try signing in.')
      }
    }

    const onSuccess = (session: any) => {
      setStatus('success')

      // Detect if this is a new social auth signup — provider !== email
      const provider = session?.user?.app_metadata?.provider
      const isSocial = provider && provider !== 'email'
      const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0]
        || session?.user?.user_metadata?.first_name
        || session?.user?.user_metadata?.name?.split(' ')[0]
        || 'there'

      if (isSocial) {
        setMessage(`Welcome! You're signed in via ${provider}. Redirecting...`)

        // Fire social welcome email (fire-and-forget) — only for new users
        const createdAt = new Date(session.user.created_at).getTime()
        const isNew = Date.now() - createdAt < 60_000 // created within last minute
        if (isNew && session.user.email) {
          const providerLabel = provider === 'azure' ? 'Microsoft' : provider.charAt(0).toUpperCase() + provider.slice(1)
          emailService.sendSocialWelcome({
            to: session.user.email,
            firstName,
            provider: providerLabel,
            dashboardUrl: `${window.location.origin}/dashboard`,
          }).catch(() => { /* silent */ })
        }
      } else {
        setMessage('Your email has been confirmed. Redirecting...')
      }

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
