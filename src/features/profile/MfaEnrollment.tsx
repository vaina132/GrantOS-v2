import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { ShieldCheck, QrCode, Trash2, CheckCircle, Loader2 } from 'lucide-react'
import { writeSecurityAudit } from '@/services/auditWriter'

type MfaStatus = 'loading' | 'not-enrolled' | 'enrolling' | 'verifying' | 'enrolled'

export function MfaEnrollment() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<MfaStatus>('loading')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)

  useEffect(() => {
    checkMfaStatus()
  }, [])

  const checkMfaStatus = async () => {
    setStatus('loading')
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      const totp = data?.totp?.[0]
      if (totp && totp.status === 'verified') {
        setFactorId(totp.id)
        setStatus('enrolled')
      } else {
        setFactorId(null)
        setStatus('not-enrolled')
      }
    } catch {
      setStatus('not-enrolled')
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
