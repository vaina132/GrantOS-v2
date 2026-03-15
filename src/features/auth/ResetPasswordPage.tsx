import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { GrantLumeLogo, GrantLumeWordmark } from '@/components/common/GrantLumeLogo'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      toast({ title: t('auth.weakPassword'), description: t('auth.passwordMinLength'), variant: 'destructive' })
      return
    }

    if (password !== confirmPassword) {
      toast({ title: t('auth.passwordsDoNotMatch'), description: t('auth.reenterPassword'), variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      toast({ title: t('auth.passwordUpdated'), description: t('auth.passwordResetSuccess') })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.failedToUpdatePassword')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
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
            <GrantLumeLogo size={42} variant="dark" />
            <span className="text-2xl font-bold tracking-tight">GrantLume</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <KeyRound className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold leading-tight">{t('auth.setNewPassword')}</h1>
              <p className="text-blue-200 mt-1">{t('auth.chooseStrongPassword')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-[420px] space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
            <GrantLumeWordmark size={28} variant="color" />
          </div>

          {success ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t('auth.passwordUpdated')}</h2>
              <p className="text-sm text-muted-foreground">{t('auth.canNowSignIn')}</p>
              <Button className="w-full h-11 font-semibold text-base" onClick={() => navigate('/login')}>
                {t('auth.goToLogin')}
              </Button>
            </div>
          ) : !hasSession ? (
            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight">{t('auth.linkExpired')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('auth.linkExpiredDesc')}
              </p>
              <Button variant="outline" className="w-full h-11" onClick={() => navigate('/forgot-password')}>
                {t('auth.requestNewResetLink')}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">{t('auth.setNewPassword')}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.chooseStrongPassword')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      autoFocus
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
                <div className="space-y-2">
                  <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
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
                    <p className="text-[11px] text-destructive">{t('auth.passwordsDoNotMatch')}</p>
                  )}
                </div>
                <Button type="submit" className="w-full h-11 font-semibold text-base" disabled={loading}>
                  {loading ? t('auth.updatingPassword') : t('auth.updatePassword')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
