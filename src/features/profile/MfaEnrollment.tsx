import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { ShieldCheck, QrCode, Trash2, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { writeSecurityAudit } from '@/services/auditWriter'

type MfaStatus = 'loading' | 'not-enrolled' | 'enrolling' | 'verifying' | 'enrolled'

/**
 * Unlike every other form in GrantLume, MFA enrollment intentionally
 * does NOT use DraftKeeper. TOTP secrets and QR codes are sensitive
 * enough that persisting them to localStorage would be a meaningful
 * regression — someone with disk access to the browser profile could
 * reconstruct the seed even if the user never completed verification.
 *
 * Instead, we surface Supabase's own record of unverified factors as
 * the orphan signal. If the user starts enrollment and walks away, the
 * next visit shows an explicit "you have an unfinished MFA setup"
 * warning with explicit resume/remove actions — no automatic rehydration
 * of QR/secret.
 */

export function MfaEnrollment() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<MfaStatus>('loading')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)
  // Id of any orphan (unverified) factor left behind by a previous
  // enrollment attempt that didn't complete. We only expose a
  // resume/remove affordance — never auto-restore the QR/secret.
  const [orphanFactorId, setOrphanFactorId] = useState<string | null>(null)

  useEffect(() => {
    checkMfaStatus()
  }, [])

  const checkMfaStatus = async () => {
    setStatus('loading')
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      const factors = data?.totp ?? []
      const verified = factors.find((f) => f.status === 'verified')
      const unverified = factors.find((f) => f.status !== 'verified')
      if (verified) {
        setFactorId(verified.id)
        setOrphanFactorId(null)
        setStatus('enrolled')
      } else {
        setFactorId(null)
        // A lingering unverified factor is an orphan — surface it so the
        // user can resume or remove explicitly.
        setOrphanFactorId(unverified?.id ?? null)
        setStatus('not-enrolled')
      }
    } catch {
      setOrphanFactorId(null)
      setStatus('not-enrolled')
    }
  }

  /**
   * Remove the orphan and start a fresh enrollment. We can't re-show the
   * original QR — Supabase doesn't expose the secret after enroll —
   * so the only safe path is to unenroll and re-enroll.
   */
  const handleResumeOrphan = async () => {
    if (!orphanFactorId) return
    try {
      await supabase.auth.mfa.unenroll({ factorId: orphanFactorId }).catch(() => {})
      setOrphanFactorId(null)
      await handleStartEnrollment()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume MFA setup'
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    }
  }

  const handleRemoveOrphan = async () => {
    if (!orphanFactorId) return
    try {
      await supabase.auth.mfa.unenroll({ factorId: orphanFactorId })
      setOrphanFactorId(null)
      writeSecurityAudit({ action: 'mfa_unenroll', details: 'Removed unverified TOTP factor' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove unverified factor'
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    }
  }

  const handleStartEnrollment = async () => {
    setStatus('enrolling')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'GrantLume Authenticator',
      })
      if (error) throw error
      if (data) {
        setQrCode(data.totp.qr_code)
        setSecret(data.totp.secret)
        setFactorId(data.id)
        setStatus('verifying')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start MFA enrollment'
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
      setStatus('not-enrolled')
    }
  }

  const handleVerifyEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return
    setVerifying(true)
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      })
      if (verifyErr) throw verifyErr

      setStatus('enrolled')
      setQrCode('')
      setSecret('')
      setVerifyCode('')
      writeSecurityAudit({ action: 'mfa_enroll', details: 'TOTP factor enrolled' })
      toast({ title: t('auth.mfaEnrolled'), description: t('auth.mfaEnrolledDesc') })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
      setVerifyCode('')
    } finally {
      setVerifying(false)
    }
  }

  const handleUnenroll = async () => {
    if (!factorId) return
    setUnenrolling(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      setFactorId(null)
      setStatus('not-enrolled')
      writeSecurityAudit({ action: 'mfa_unenroll', details: 'TOTP factor removed' })
      toast({ title: t('auth.mfaRemoved'), description: t('auth.mfaRemovedDesc') })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove MFA'
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setUnenrolling(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{t('auth.mfaSectionTitle')}</CardTitle>
        </div>
        <CardDescription>{t('auth.mfaSectionDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        )}

        {orphanFactorId && status === 'not-enrolled' && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/15">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-amber-900 dark:text-amber-200">
                Unfinished MFA setup
              </div>
              <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
                You started setting up two-factor authentication but didn't finish verifying it. For security we can't show the original QR again — start fresh or remove the pending setup.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRemoveOrphan}>
                Remove
              </Button>
              <Button size="sm" onClick={handleResumeOrphan}>
                Start fresh
              </Button>
            </div>
          </div>
        )}

        {status === 'enrolled' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                {t('auth.mfaEnabled')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleUnenroll}
              disabled={unenrolling}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {unenrolling ? t('common.loading') : t('auth.mfaDisable')}
            </Button>
          </div>
        )}

        {status === 'not-enrolled' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('auth.mfaNotEnrolled')}</p>
            <Button onClick={handleStartEnrollment} size="sm" className="gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              {t('auth.mfaEnable')}
            </Button>
          </div>
        )}

        {status === 'verifying' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('auth.mfaScanQR')}</p>
              <p className="text-xs text-muted-foreground">{t('auth.mfaScanQRDesc')}</p>
            </div>

            {qrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>
            )}

            {secret && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('auth.mfaManualEntry')}</p>
                <code className="block p-2 bg-muted rounded text-xs font-mono break-all select-all">
                  {secret}
                </code>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('auth.mfaEnterCode')}</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-36 text-center font-mono tracking-[0.5em]"
                />
                <Button
                  onClick={handleVerifyEnrollment}
                  disabled={verifying || verifyCode.length !== 6}
                  size="sm"
                >
                  {verifying ? t('common.loading') : t('auth.mfaVerify')}
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus('not-enrolled')
                setQrCode('')
                setSecret('')
                setVerifyCode('')
                // Unenroll the unverified factor
                if (factorId) {
                  supabase.auth.mfa.unenroll({ factorId }).catch(() => {})
                  setFactorId(null)
                }
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
