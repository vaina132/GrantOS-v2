import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
      toast({
        title: 'Reset link sent',
        description: 'Check your email for a password reset link.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset link.'
      toast({ title: 'Error', description: message, variant: 'destructive' })
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm font-bold text-2xl">
              G
            </div>
            <span className="text-2xl font-bold tracking-tight">GrantLume</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold leading-tight">Account recovery</h1>
              <p className="text-blue-200 mt-1">We'll help you get back into your account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-[420px] space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
              G
            </div>
            <span className="text-xl font-bold tracking-tight">GrantLume</span>
          </div>

          {sent ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  We sent a password reset link to <strong className="text-foreground">{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => setSent(false)}
                    className="text-primary hover:text-primary/80 underline underline-offset-4"
                  >
                    try again
                  </button>
                </p>
              </div>
              <Link to="/login">
                <Button variant="outline" className="w-full h-11">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Reset your password</h2>
                <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
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
                <Button type="submit" className="w-full h-11 font-semibold text-base" disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
                  <ArrowLeft className="inline mr-1 h-3 w-3" />
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
