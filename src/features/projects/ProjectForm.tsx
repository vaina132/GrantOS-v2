import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { projectsService } from '@/services/projectsService'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { useProject } from '@/hooks/useProjects'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Save, DollarSign, Users, Plane, Handshake, Package } from 'lucide-react'
import { computeProjectStatus } from '@/lib/utils'
import type { FundingScheme } from '@/types'

const positiveOrNull = z.coerce.number().min(0, 'Must be 0 or greater').nullable().optional()

const projectSchema = z.object({
  acronym: z.string().min(1, 'Acronym is required').max(20, 'Max 20 characters'),
  title: z.string().min(1, 'Title is required').max(200, 'Max 200 characters'),
  funding_scheme_id: z.string().nullable().or(z.literal('')),
  grant_number: z.string().nullable().or(z.literal('')),
  status: z.enum(['Upcoming', 'Active', 'Completed', 'Suspended']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  total_budget: positiveOrNull,
  overhead_rate: z.coerce.number().min(0).max(100, 'Max 100%').nullable().optional(),
  has_wps: z.boolean(),
  is_lead_organisation: z.boolean(),
  our_pm_rate: positiveOrNull,
  budget_personnel: positiveOrNull,
  budget_travel: positiveOrNull,
  budget_subcontracting: positiveOrNull,
  budget_other: positiveOrNull,
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date)
  }
  return true
}, { message: 'End date must be after start date', path: ['end_date'] })

type ProjectFormData = z.infer<typeof projectSchema>

export function ProjectForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id && id !== 'new'
  const { orgId, can } = useAuthStore()
  const { project, isLoading: loadingProject } = useProject(isEdit ? id : undefined)
  const [saving, setSaving] = useState(false)
  const [schemes, setSchemes] = useState<FundingScheme[]>([])

  useEffect(() => {
    settingsService.listFundingSchemes(orgId).then(setSchemes).catch(() => {})
  }, [orgId])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      acronym: '',
      title: '',
      funding_scheme_id: '',
      grant_number: '',
      status: 'Upcoming',
      start_date: '',
      end_date: '',
      total_budget: null,
      overhead_rate: null,
      has_wps: false,
      is_lead_organisation: false,
      our_pm_rate: null,
      budget_personnel: null,
      budget_travel: null,
      budget_subcontracting: null,
      budget_other: null,
    },
  })

  // Auto-compute status from dates
  const watchStartDate = watch('start_date')
  const watchEndDate = watch('end_date')
  const watchStatus = watch('status')
  useEffect(() => {
    if (!watchStartDate || !watchEndDate) return
    // Don't override if user manually set Suspended
    if (watchStatus === 'Suspended') return
    const computed = computeProjectStatus(watchStartDate, watchEndDate)
    if (computed !== watchStatus) {
      setValue('status', computed)
    }
  }, [watchStartDate, watchEndDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill overhead rate when funding scheme changes
  const selectedSchemeId = watch('funding_scheme_id')
  useEffect(() => {
    if (!selectedSchemeId) return
    const scheme = schemes.find((s) => s.id === selectedSchemeId)
    if (scheme && scheme.overhead_rate != null) {
      setValue('overhead_rate', scheme.overhead_rate)
    }
  }, [selectedSchemeId, schemes, setValue])

  useEffect(() => {
    if (project) {
      reset({
        acronym: project.acronym,
        title: project.title,
        funding_scheme_id: project.funding_scheme_id ?? '',
        grant_number: project.grant_number ?? '',
        status: project.status as ProjectFormData['status'],
        start_date: project.start_date,
        end_date: project.end_date,
        total_budget: project.total_budget,
        overhead_rate: project.overhead_rate,
        has_wps: project.has_wps,
        is_lead_organisation: project.is_lead_organisation ?? false,
        our_pm_rate: project.our_pm_rate,
        budget_personnel: project.budget_personnel,
        budget_travel: project.budget_travel,
        budget_subcontracting: project.budget_subcontracting,
        budget_other: project.budget_other,
      })
    }
  }, [project, reset])

  const onSubmit = async (data: ProjectFormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        funding_scheme_id: data.funding_scheme_id || null,
        grant_number: data.grant_number || null,
        total_budget: data.total_budget ?? null,
        overhead_rate: data.overhead_rate ?? null,
        our_pm_rate: data.our_pm_rate ?? null,
        budget_personnel: data.budget_personnel ?? null,
        budget_travel: data.budget_travel ?? null,
        budget_subcontracting: data.budget_subcontracting ?? null,
        budget_other: data.budget_other ?? null,
        org_id: orgId ?? '',
      }

      if (isEdit) {
        await projectsService.update(id, payload)
        toast({ title: 'Updated', description: `${data.acronym} has been updated.` })
      } else {
        await projectsService.create(payload as Parameters<typeof projectsService.create>[0])
        toast({ title: 'Created', description: `${data.acronym} has been created.` })
      }
      navigate('/projects')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && loadingProject) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? `Edit ${project?.acronym ?? 'Project'}` : 'New Project'}
        actions={
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="acronym">Acronym *</Label>
                  <Input id="acronym" {...register('acronym')} />
                  {errors.acronym && <p className="text-sm text-destructive">{errors.acronym.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grant_number">Grant Number</Label>
                  <Input id="grant_number" {...register('grant_number')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...register('title')} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="funding_scheme_id">Funding Scheme</Label>
                  <select
                    id="funding_scheme_id"
                    {...register('funding_scheme_id')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">None</option>
                    {schemes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    {...register('status')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input id="start_date" type="date" {...register('start_date')} />
                  {errors.start_date && <p className="text-sm text-destructive">{errors.start_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input id="end_date" type="date" {...register('end_date')} />
                  {errors.end_date && <p className="text-sm text-destructive">{errors.end_date.message}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="has_wps"
                  {...register('has_wps')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="has_wps">Uses Work Packages</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_lead_organisation"
                  {...register('is_lead_organisation')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_lead_organisation">Led by Our Organisation</Label>
                <span className="text-[10px] text-muted-foreground">(enables partner invitations later)</span>
              </div>
            </CardContent>
          </Card>

          {can('canSeeFinancialDetails') && (
            <Card>
              <CardHeader><CardTitle>Budget</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="total_budget" className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-muted-foreground" /> Total Budget
                  </Label>
                  <Input id="total_budget" type="number" step="0.01" {...register('total_budget')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="overhead_rate">Overhead Rate (%)</Label>
                    <Input id="overhead_rate" type="number" step="0.01" {...register('overhead_rate')} />
                  </div>
                  {can('canSeePersonnelRates') && (
                    <div className="space-y-2">
                      <Label htmlFor="our_pm_rate">Our PM Rate</Label>
                      <Input id="our_pm_rate" type="number" step="0.01" {...register('our_pm_rate')} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget_personnel" className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" /> Personnel Budget
                  </Label>
                  <Input id="budget_personnel" type="number" step="0.01" {...register('budget_personnel')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_travel" className="flex items-center gap-1.5">
                    <Plane className="h-4 w-4 text-muted-foreground" /> Travel Budget
                  </Label>
                  <Input id="budget_travel" type="number" step="0.01" {...register('budget_travel')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_subcontracting" className="flex items-center gap-1.5">
                    <Handshake className="h-4 w-4 text-muted-foreground" /> Subcontracting Budget
                  </Label>
                  <Input id="budget_subcontracting" type="number" step="0.01" {...register('budget_subcontracting')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_other" className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-muted-foreground" /> Other Budget
                  </Label>
                  <Input id="budget_other" type="number" step="0.01" {...register('budget_other')} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/projects')}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  )
}
