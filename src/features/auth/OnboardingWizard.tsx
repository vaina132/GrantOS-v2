import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useDraftKeeper } from '@/lib/draftKeeper'
import { DraftSavePill, DraftRestoreBanner } from '@/components/draft'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { emailService } from '@/services/emailService'
import { Building2, ArrowRight, Check } from 'lucide-react'
import { CURRENCIES } from '@/data/currencies'

type Step = 'org' | 'project' | 'done'

/**
 * One draft envelope covering both phases of onboarding. Per the team
 * Decision C, using separate keys per phase would mean the 'org' draft
 * silently goes stale the moment the user advances — so we carry `step`
 * and the already-created `orgId` inside the draft. On reload mid-wizard
 * we jump straight back to the right phase without making the user
 * re-type the organisation they already created on the server.
 */
type OnboardingDraft = {
  step: Step
  orgName: string
  currency: string
  projectAcronym: string
  projectTitle: string
  startDate: string
  endDate: string
  orgId: string | null
}

const EMPTY_ONBOARDING: OnboardingDraft = {
  step: 'org',
  orgName: '',
  currency: 'EUR',
  projectAcronym: '',
  projectTitle: '',
  startDate: '',
  endDate: '',
  orgId: null,
}

export function OnboardingWizard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [step, setStep] = useState<Step>('org')
  const [loading, setLoading] = useState(false)

  // Derive display name from auth metadata (social auth populates these)
  const userName = useMemo(() => {
    const meta = user?.user_metadata
    if (meta?.first_name && meta?.last_name) return `${meta.first_name} ${meta.last_name}`
    if (meta?.full_name) return meta.full_name
    if (meta?.name) return meta.name
    return user?.email?.split('@')[0] || 'there'
  }, [user])

  // Org step
  const [orgName, setOrgName] = useState('')
  const [currency, setCurrency] = useState('EUR')

  // Project step (optional)
  const [projectAcronym, setProjectAcronym] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [orgId, setOrgId] = useState<string | null>(null)

  const draftValue = useMemo<OnboardingDraft>(
    () => ({ step, orgName, currency, projectAcronym, projectTitle, startDate, endDate, orgId }),
    [step, orgName, currency, projectAcronym, projectTitle, startDate, endDate, orgId],
  )

  // Single-key-with-phase draft (team Decision C). User has no org yet,
  // so we use the sentinel '_no-org' for orgId in the key. The draft
  // auto-clears when the user hits the 'done' terminal state.
  const draft = useDraftKeeper<OnboardingDraft>({
    key: {
      orgId: '_no-org',
      userId: user?.id ?? '_anon',
      formKey: 'onboarding',
      recordId: 'new',
    },
    value: draftValue,
    setValue: (next) => {
      // Never rehydrate into 'done' — it's a terminal state with no
      // recoverable intent. If the draft was saved at 'done', treat it
      // as already finished and drop to the initial step.
      setStep(next.step === 'done' ? 'org' : next.step)
      setOrgName(next.orgName)
      setCurrency(next.currency || 'EUR')
      setProjectAcronym(next.projectAcronym)
      setProjectTitle(next.projectTitle)
      setStartDate(next.startDate)
      setEndDate(next.endDate)
      setOrgId(next.orgId)
    },
    enabled: !!user?.id && step !== 'done',
    schemaVersion: 1,
    baseline: EMPTY_ONBOARDING,
    silentRestoreWindowMs: 0,
  })

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !user) return
    setLoading(true)
    try {
      // Use SECURITY DEFINER function to create org + membership atomically
      // This bypasses RLS, avoiding permission issues during onboarding
      const { data: newOrgId, error } = await supabase
        .rpc('create_organisation', {
          p_name: orgName.trim(),
          p_currency: currency,
        })

      if (error) throw error

      setOrgId(newOrgId as string)
      toast({ title: t('onboarding.orgCreated') })
      setStep('project')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('onboarding.failedToCreateOrg')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!orgId || !projectAcronym.trim() || !projectTitle.trim() || !startDate || !endDate) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          org_id: orgId,
          acronym: projectAcronym.trim(),
          title: projectTitle.trim(),
          start_date: startDate,
          end_date: endDate,
          status: 'Active',
        })

      if (error) throw error
      toast({ title: t('onboarding.projectCreated') })
      setStep('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('onboarding.failedToCreateProject')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = async () => {
    // Send welcome email (fire-and-forget)
    if (user?.email) {
      emailService.sendWelcome({
        to: user.email,
        userName,
        orgName: orgName || 'your organisation',
        dashboardUrl: `${window.location.origin}/dashboard`,
      }).catch(() => { /* non-blocking */ })
    }

    // Onboarding committed — drop the draft so the user doesn't see a
    // restore banner the next time they land somewhere form-y.
    draft.discard()

    // Re-initialize auth to pick up the new org membership
    window.location.href = '/dashboard'
  }

  const handleSkipProject = () => {
    setStep('done')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
      <div className="w-full max-w-lg space-y-3">
        {draft.hasDraft && (
          <DraftRestoreBanner
            ageMs={draft.draftAge}
            onRestore={draft.restore}
            onDiscard={draft.discard}
          />
        )}
        <div className="flex justify-end">
          <DraftSavePill
            status={draft.status}
            lastSavedAt={draft.lastSavedAt}
            className="text-white/80"
          />
        </div>
      <Card className="w-full max-w-lg border-0 shadow-2xl">
        {step === 'org' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">{t('onboarding.welcome', { name: userName.split(' ')[0] })}</CardTitle>
              <CardDescription>
                {t('onboarding.setupOrgDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">{t('onboarding.orgName')} *</Label>
                <Input
                  id="orgName"
                  placeholder="e.g. My Research Lab"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t('onboarding.currency')}</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateOrg}
                disabled={loading || !orgName.trim()}
              >
                {loading ? t('common.creating') : t('onboarding.createOrg')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              {/* Step indicator */}
              <div className="flex justify-center gap-2 pt-2">
                <div className="h-2 w-8 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-muted" />
                <div className="h-2 w-8 rounded-full bg-muted" />
              </div>
            </CardContent>
          </>
        )}

        {step === 'project' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{t('onboarding.addFirstProject')}</CardTitle>
              <CardDescription>
                {t('onboarding.addProjectLater')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('onboarding.acronym')} *</Label>
                  <Input
                    placeholder="e.g. HORIZON"
                    value={projectAcronym}
                    onChange={(e) => setProjectAcronym(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>{t('common.title')} *</Label>
                  <Input
                    placeholder="Full project title"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.start')} *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.end')} *</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleSkipProject}>
                  {t('onboarding.skipForNow')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateProject}
                  disabled={loading || !projectAcronym.trim() || !projectTitle.trim() || !startDate || !endDate}
                >
                  {loading ? t('common.creating') : t('onboarding.createProject')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <div className="h-2 w-8 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-muted" />
              </div>
            </CardContent>
          </>
        )}

        {step === 'done' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">{t('onboarding.allSet')}</CardTitle>
              <CardDescription>
                {t('onboarding.workspaceReady')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleFinish}>
                {t('onboarding.goToDashboard')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="flex justify-center gap-2 pt-4">
                <div className="h-2 w-8 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-primary" />
              </div>
            </CardContent>
          </>
        )}
      </Card>
      </div>
    </div>
  )
}
