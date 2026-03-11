import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { emailService } from '@/services/emailService'
import { Building2, ArrowRight, Check } from 'lucide-react'

type Step = 'org' | 'project' | 'done'

export function OnboardingWizard() {
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
      toast({ title: 'Organisation created!' })
      setStep('project')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organisation'
      toast({ title: 'Error', description: message, variant: 'destructive' })
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
      toast({ title: 'Project created!' })
      setStep('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      toast({ title: 'Error', description: message, variant: 'destructive' })
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

    // Re-initialize auth to pick up the new org membership
    window.location.href = '/dashboard'
  }

  const handleSkipProject = () => {
    setStep('done')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
      <Card className="w-full max-w-lg border-0 shadow-2xl">
        {step === 'org' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome, {userName.split(' ')[0]}!</CardTitle>
              <CardDescription>
                Set up your organisation — this is your workspace where you'll manage grants, staff, and budgets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organisation Name *</Label>
                <Input
                  id="orgName"
                  placeholder="e.g. My Research Lab"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CHF">CHF</option>
                  <option value="SEK">SEK</option>
                  <option value="NOK">NOK</option>
                  <option value="DKK">DKK</option>
                </select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateOrg}
                disabled={loading || !orgName.trim()}
              >
                {loading ? 'Creating...' : 'Create Organisation'}
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
              <CardTitle className="text-2xl">Add your first project</CardTitle>
              <CardDescription>
                You can always add more projects later from the Projects page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Acronym *</Label>
                  <Input
                    placeholder="e.g. HORIZON"
                    value={projectAcronym}
                    onChange={(e) => setProjectAcronym(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Full project title"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleSkipProject}>
                  Skip for now
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateProject}
                  disabled={loading || !projectAcronym.trim() || !projectTitle.trim() || !startDate || !endDate}
                >
                  {loading ? 'Creating...' : 'Create Project'}
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
              <CardTitle className="text-2xl">You're all set!</CardTitle>
              <CardDescription>
                Your workspace is ready. Start by adding staff members and managing your projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleFinish}>
                Go to Dashboard
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
  )
}
