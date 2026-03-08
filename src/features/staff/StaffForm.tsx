import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { staffService } from '@/services/staffService'
import { useAuthStore } from '@/stores/authStore'
import { useStaffMember } from '@/hooks/useStaff'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Save } from 'lucide-react'

const staffSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100, 'Max 100 characters'),
  email: z.string().email('Invalid email').nullable().or(z.literal('')),
  department: z.string().max(100).nullable().or(z.literal('')),
  role: z.string().max(100).nullable().or(z.literal('')),
  employment_type: z.enum(['Full-time', 'Part-time', 'Contractor']),
  fte: z.coerce.number().min(0, 'Min 0').max(1, 'Max 1'),
  start_date: z.string().nullable().or(z.literal('')),
  end_date: z.string().nullable().or(z.literal('')),
  annual_salary: z.coerce.number().min(0, 'Must be 0 or greater').nullable().optional(),
  overhead_rate: z.coerce.number().min(0).max(100, 'Max 100%').nullable().optional(),
  is_active: z.boolean(),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date)
  }
  return true
}, { message: 'End date must be after start date', path: ['end_date'] })

type StaffFormData = z.infer<typeof staffSchema>

export function StaffForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id && id !== 'new'
  const { orgId, can } = useAuthStore()
  const { person, isLoading: loadingPerson } = useStaffMember(isEdit ? id : undefined)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: '',
      email: '',
      department: '',
      role: '',
      employment_type: 'Full-time',
      fte: 1,
      start_date: '',
      end_date: '',
      annual_salary: null,
      overhead_rate: null,
      is_active: true,
    },
  })

  useEffect(() => {
    if (person) {
      reset({
        full_name: person.full_name,
        email: person.email ?? '',
        department: person.department ?? '',
        role: person.role ?? '',
        employment_type: person.employment_type,
        fte: person.fte,
        start_date: person.start_date ?? '',
        end_date: person.end_date ?? '',
        annual_salary: person.annual_salary,
        overhead_rate: person.overhead_rate,
        is_active: person.is_active,
      })
    }
  }, [person, reset])

  const onSubmit = async (data: StaffFormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        email: data.email || null,
        department: data.department || null,
        role: data.role || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        annual_salary: data.annual_salary ?? null,
        overhead_rate: data.overhead_rate ?? null,
        org_id: orgId ?? '',
      }

      if (isEdit) {
        await staffService.update(id, payload)
        toast({ title: 'Updated', description: `${data.full_name} has been updated.` })
      } else {
        await staffService.create(payload as Parameters<typeof staffService.create>[0])
        toast({ title: 'Created', description: `${data.full_name} has been added.` })
      }
      navigate('/staff')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && loadingPerson) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? `Edit ${person?.full_name ?? 'Person'}` : 'Add New Person'}
        actions={
          <Button variant="outline" onClick={() => navigate('/staff')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" {...register('full_name')} />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" {...register('department')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role / Title</Label>
                  <Input id="role" {...register('role')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment Type</Label>
                  <select
                    id="employment_type"
                    {...register('employment_type')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contractor">Contractor</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fte">FTE (0–1)</Label>
                  <Input id="fte" type="number" step="0.01" min="0" max="1" {...register('fte')} />
                  {errors.fte && (
                    <p className="text-sm text-destructive">{errors.fte.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register('is_active')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates & Financial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" {...register('start_date')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" {...register('end_date')} />
                </div>
              </div>

              {can('canSeeSalary') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="annual_salary">Annual Salary</Label>
                    <Input
                      id="annual_salary"
                      type="number"
                      step="0.01"
                      {...register('annual_salary')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overhead_rate">Overhead Rate (%)</Label>
                    <Input
                      id="overhead_rate"
                      type="number"
                      step="0.01"
                      {...register('overhead_rate')}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/staff')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Person' : 'Create Person'}
          </Button>
        </div>
      </form>
    </div>
  )
}
