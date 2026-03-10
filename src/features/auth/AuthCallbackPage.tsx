import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle } from 'lucide-react'

/**
 * Handles Supabase auth redirects:
 * - Email confirmation after signup
 * - Magic link login
 * - OAuth callback
 * Supabase appends #access_token=...&type=... to the URL
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
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
          setStatus('success')
          setMessage('Your email has been confirmed. Redirecting...')
          setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
        } else {
          // No session yet — the auth state change listener might handle it
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              setStatus('success')
              setMessage('Your email has been confirmed. Redirecting...')
              setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
              subscription.unsubscribe()
            }
          })

          // Timeout after 5 seconds
          setTimeout(() => {
            if (status === 'loading') {
              setStatus('error')
              setMessage('Unable to verify your email. The link may have expired. Please try signing in.')
              subscription.unsubscribe()
            }
          }, 5000)
        }
      } catch {
        setStatus('error')
        setMessage('Something went wrong. Please try signing in.')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg shadow-primary/25">
              G
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {status === 'loading' && 'Verifying...'}
              {status === 'success' && 'Email Confirmed'}
              {status === 'error' && 'Verification Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {status === 'loading' && (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            )}
            {status === 'success' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            )}
            {status === 'error' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Go to sign in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
