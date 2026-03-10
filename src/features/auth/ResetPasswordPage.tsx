import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { CheckCircle2 } from 'lucide-react'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Supabase redirects here with a session after clicking the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true)
      }
    })

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters.', variant: 'destructive' })
      return
    }

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please re-enter your password.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      toast({ title: 'Password updated', description: 'Your password has been reset successfully.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password.'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg shadow-primary/25">
              G
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {success ? 'Password updated' : 'Set new password'}
            </CardTitle>
            <CardDescription className="text-sm">
              {success
                ? 'You can now sign in with your new password'
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {success ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <Button className="w-full h-10 font-semibold" onClick={() => navigate('/login')}>
                  Go to sign in
                </Button>
              </div>
            ) : !hasSession ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  This link may have expired or is invalid. Please request a new password reset.
                </p>
                <Button variant="outline" className="w-full" onClick={() => navigate('/forgot-password')}>
                  Request new reset link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    autoFocus
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                  {loading ? 'Updating...' : 'Update password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
