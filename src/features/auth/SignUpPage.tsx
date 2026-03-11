import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Eye, EyeOff, CheckCircle2, Shield, Zap, CreditCard } from 'lucide-react'
import { emailService } from '@/services/emailService'

export function SignUpPage() {
  const navigate = useNavigate()
  const { signUp } = useAuthStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Honeypot anti-bot field (hidden from real users)
  const honeypotRef = useRef<HTMLInputElement>(null)

  const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-500' }
    if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500' }
    return { score, label: 'Strong', color: 'bg-green-500' }
  }

  const strength = passwordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Honeypot check — if the hidden field is filled, it's a bot
    if (honeypotRef.current?.value) {
      // Silently reject
      toast({ title: 'Account created', description: 'Check your email to confirm.' })
      return
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your first and last name.', variant: 'destructive' })
      return
    }

    if (password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters.', variant: 'destructive' })
      return
    }

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please re-enter your password.', variant: 'destructive' })
      return
    }

    if (!agreedTerms) {
      toast({ title: 'Terms required', description: 'You must agree to the Terms of Use and Privacy Policy.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, { firstName: firstName.trim(), lastName: lastName.trim() })
      setSuccess(true)

      // Fire signup confirmation email (fire-and-forget)
      emailService.sendSignupConfirmation({
        to: email,
        firstName: firstName.trim(),
        confirmUrl: `${window.location.origin}/auth/callback`,
      }).catch(() => { /* silent */ })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed.'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Success state — email confirmation
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6">
        <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
          <p className="text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Click the link to activate your account and start your 14-day free trial.
          </p>
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>Didn't receive the email? Check your spam folder or wait a few minutes.</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
            Go to login
          </Button>
        </div>
      </div>
    )
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
          <h1 className="text-4xl font-bold leading-tight">Register for free</h1>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">No payment information required</p>
                <p className="text-sm text-blue-200">Start using GrantLume immediately</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">No installation</p>
                <p className="text-sm text-blue-200">Cloud-based — works in your browser</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">14-day trial period ends automatically</p>
                <p className="text-sm text-blue-200">No obligations, cancel anytime</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — signup form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background overflow-y-auto">
        <div className="w-full max-w-[440px] space-y-6 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
              G
            </div>
            <span className="text-xl font-bold tracking-tight">GrantLume</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
            <p className="text-sm text-muted-foreground">Start your 14-day free trial — no credit card needed</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — hidden from real users, bots will fill it */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <input
                ref={honeypotRef}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  autoFocus
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Choose your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.score ? strength.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Password strength: <span className="font-medium">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password *</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="h-11"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[11px] text-destructive">Passwords do not match</p>
              )}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                By clicking you confirm that you have read and agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline font-medium" target="_blank">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary hover:underline font-medium" target="_blank">
                  Privacy Policy
                </Link>.
              </span>
            </label>

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-base"
              disabled={loading || !agreedTerms}
            >
              {loading ? 'Creating account...' : 'Test it 14 days for free'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground pt-4">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
