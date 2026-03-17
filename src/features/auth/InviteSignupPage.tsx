import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Users,
  Globe,
  Building2,
  ArrowRight,
  Loader2,
  Shield,
} from 'lucide-react'
import { GrantLumeLogo, GrantLumeWordmark } from '@/components/common/GrantLumeLogo'
import { createClient } from '@supabase/supabase-js'

// Dedicated Supabase client for signup — no session persistence
const signupClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'grantlume-invite-signup',
    },
  },
)

type InviteType = 'org' | 'collab'

interface InviteContext {
  type: InviteType
  email: string
  orgName: string
  role: string
  invitedBy: string
  orgId: string
  // Collab-specific
  token: string
  projectAcronym: string
  projectTitle: string
}

function parseInviteParams(params: URLSearchParams): InviteContext {
  return {
    type: (params.get('type') as InviteType) || 'org',
    email: params.get('email') || '',
    orgName: params.get('org') || params.get('orgName') || '',
    role: params.get('role') || '',
    invitedBy: params.get('invitedBy') || '',
    orgId: params.get('orgId') || '',
    token: params.get('token') || '',
    projectAcronym: params.get('project') || params.get('projectAcronym') || '',
    projectTitle: params.get('projectTitle') || '',
  }
}

export function InviteSignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  const invite = parseInviteParams(searchParams)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(invite.email)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [existingUser, setExistingUser] = useState(false)

  // If user is already logged in, redirect to accept flow directly
  useEffect(() => {
    if (user) {
      if (invite.type === 'collab' && invite.token) {
        navigate(`/collab/accept?token=${invite.token}`, { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [user, invite.type, invite.token, navigate])

  const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++

    if (score <= 1) return { score, label: t('auth.weak'), color: 'bg-red-500' }
    if (score <= 2) return { score, label: t('auth.fair'), color: 'bg-orange-500' }
    if (score <= 3) return { score, label: t('auth.good'), color: 'bg-yellow-500' }
    return { score, label: t('auth.strong'), color: 'bg-green-500' }
  }

  const strength = passwordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: t('auth.nameRequired'), description: t('auth.nameRequiredDesc'), variant: 'destructive' })
      return
    }

    if (password.length < 8) {
      toast({ title: t('auth.weakPassword'), description: t('auth.passwordMinLength'), variant: 'destructive' })
      return
    }

    if (password !== confirmPassword) {
      toast({ title: t('auth.passwordsDoNotMatch'), description: t('auth.reenterPassword'), variant: 'destructive' })
      return
    }

    if (!agreedTerms) {
      toast({ title: t('auth.termsRequired'), description: t('auth.termsRequiredDesc'), variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      // Build redirect URL that will auto-accept the invitation after email confirmation
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
      // Encode invite context into the redirect so AuthCallbackPage can process it
      const inviteData = {
        type: invite.type,
        orgId: invite.orgId,
        token: invite.token,
        role: invite.role,
      }

      const { data, error } = await signupClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            invite_context: inviteData,
          },
          emailRedirectTo: callbackUrl.toString(),
        },
      })

      if (error) throw error

      // Supabase returns a user with empty identities when the email already exists
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setExistingUser(true)
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.signUpFailed')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async () => {
    try {
      const { error } = await signupClient.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      toast({ title: t('auth.emailSent'), description: t('auth.confirmationResent') })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.failedToResend')
      toast({ title: t('common.error'), description: msg, variant: 'destructive' })
    }
  }

  // Build the login URL with invite context preserved
  const loginUrl = (() => {
    const params = new URLSearchParams()
    if (invite.type === 'collab' && invite.token) {
      params.set('redirect', `/collab/accept?token=${invite.token}`)
    }
    if (email) params.set('email', email)
    const qs = params.toString()
    return `/login${qs ? `?${qs}` : ''}`
  })()

  // ── Existing user state ──
  if (existingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6">
        <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{t('invite.accountExists')}</h2>
          <p className="text-muted-foreground">
            {t('invite.accountExistsDesc', { email })}
          </p>
          {invite.orgName && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium">{invite.orgName}</p>
              {invite.role && <p className="text-muted-foreground">{t('invite.role')}: {invite.role}</p>}
            </div>
          )}
          <Button className="w-full h-11 font-semibold" onClick={() => navigate(loginUrl)}>
            {t('invite.signInToAccept')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ── Success state — email confirmation ──
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6">
        <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{t('auth.checkYourEmail')}</h2>
          <p className="text-muted-foreground">
            {t('auth.confirmationSent')} <strong className="text-foreground">{email}</strong>.
            {t('auth.clickToActivate')}
          </p>
          {invite.orgName && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-left space-y-1">
              <p className="font-medium text-blue-900">
                {invite.type === 'collab' ? t('invite.afterConfirmCollab') : t('invite.afterConfirmOrg')}
              </p>
              <p className="text-blue-700">
                {invite.type === 'collab'
                  ? t('invite.afterConfirmCollabDesc', { project: invite.projectAcronym || invite.orgName })
                  : t('invite.afterConfirmOrgDesc', { org: invite.orgName })}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
            <p>{t('auth.didntReceive')}</p>
            <button onClick={handleResendEmail} className="text-primary hover:underline font-medium">
              {t('auth.resendConfirmation')}
            </button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
            {t('auth.goToLogin')}
          </Button>
        </div>
      </div>
    )
  }

  // ── Main signup form ──
  const isCollab = invite.type === 'collab'
  const InviteIcon = isCollab ? Globe : Building2

  return (
    <div className="flex min-h-screen">
      {/* Left panel — invitation context */}
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
          <h1 className="text-3xl font-bold leading-tight">
            {t('invite.youveBeenInvited')}
          </h1>

          {/* Invitation details card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15">
                <InviteIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {invite.orgName || t('invite.anOrganisation')}
                </p>
                {invite.projectAcronym && (
                  <p className="text-blue-200 text-sm">{invite.projectAcronym}</p>
                )}
              </div>
            </div>
            {invite.role && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-200">{t('invite.yourRole')}</span>
                <span className="font-medium bg-white/15 px-3 py-1 rounded-full text-xs">
                  {invite.role}
                </span>
              </div>
            )}
            {invite.invitedBy && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-200">{t('invite.invitedBy')}</span>
                <span className="font-medium">{invite.invitedBy}</span>
              </div>
            )}
            {isCollab && invite.projectTitle && (
              <p className="text-sm text-blue-200 pt-1 border-t border-white/10">
                {invite.projectTitle}
              </p>
            )}
          </div>

          <div className="space-y-3 text-sm text-blue-100">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-300 shrink-0" />
              <span>{t('invite.secureAndPrivate')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-300 shrink-0" />
              <span>{t('invite.freeToJoin')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — signup form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background overflow-y-auto">
        <div className="w-full max-w-[440px] space-y-6 animate-fade-in">
          {/* Mobile logo + invite badge */}
          <div className="lg:hidden flex items-center justify-center mb-2">
            <GrantLumeWordmark size={36} variant="color" textClassName="text-xl font-bold tracking-tight" />
          </div>

          {/* Mobile invite context */}
          {invite.orgName && (
            <div className="lg:hidden rounded-lg bg-blue-50 border border-blue-100 p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                <InviteIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-blue-900 truncate">{invite.orgName}</p>
                {invite.role && <p className="text-xs text-blue-600">{invite.role}</p>}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{t('invite.createYourAccount')}</h2>
            <p className="text-sm text-muted-foreground">
              {invite.orgName
                ? t('invite.createToJoin', { org: invite.orgName })
                : t('invite.createToGetStarted')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('auth.firstName')} *</Label>
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
                <Label htmlFor="lastName">{t('auth.lastName')} *</Label>
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
              <Label htmlFor="email">{t('auth.email')} *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
                readOnly={!!invite.email}
                tabIndex={invite.email ? -1 : undefined}
              />
              {invite.email && (
                <p className="text-[11px] text-muted-foreground">
                  {t('invite.emailPreFilled')}
                </p>
              )}
            </div>

            {invite.orgName && (
              <div className="space-y-2">
                <Label htmlFor="organisation">{t('invite.organisation')}</Label>
                <Input
                  id="organisation"
                  type="text"
                  value={invite.orgName}
                  readOnly
                  tabIndex={-1}
                  className="h-11 bg-muted/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('invite.orgPreFilled')}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')} *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('invite.choosePassword')}
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
                    {t('auth.passwordStrength')}: <span className="font-medium">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">{t('auth.confirmPassword')} *</Label>
              <Input
                id="confirm"
                type="password"
                placeholder={t('invite.reEnterPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="h-11"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[11px] text-destructive">{t('auth.passwordsDoNotMatch')}</p>
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
                {t('auth.termsAgree')}{' '}
                <Link to="/terms" className="text-primary hover:underline font-medium" target="_blank">
                  {t('auth.termsOfUse')}
                </Link>{' '}
                {t('common.and')}{' '}
                <Link to="/privacy" className="text-primary hover:underline font-medium" target="_blank">
                  {t('auth.privacyPolicy')}
                </Link>.
              </span>
            </label>

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-base"
              disabled={loading || !agreedTerms}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.creatingAccount')}
                </>
              ) : (
                <>
                  {t('invite.createAndJoin')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground pt-2">
            {t('invite.alreadyHaveAccount')}{' '}
            <Link to={loginUrl} className="font-semibold text-primary hover:text-primary/80 transition-colors">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
