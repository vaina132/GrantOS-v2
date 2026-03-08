import { useNavigate, useParams } from 'react-router-dom'
import { useStaffMember } from '@/hooks/useStaff'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Pencil } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export function StaffDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { person, isLoading } = useStaffMember(id)
  const { can } = useAuthStore()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="space-y-6">
        <PageHeader title="Person Not Found" />
        <Button variant="outline" onClick={() => navigate('/staff')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Staff
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={person.full_name}
        description={[person.department, person.role].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/staff')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {can('canWrite') && (
              <Button onClick={() => navigate(`/staff/${person.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="text-sm font-medium">{person.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Department</dt>
                <dd className="text-sm font-medium">{person.department ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Role</dt>
                <dd className="text-sm font-medium">{person.role ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Employment Type</dt>
                <dd><Badge variant="secondary">{person.employment_type}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">FTE</dt>
                <dd className="text-sm font-medium tabular-nums">{person.fte.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={person.is_active ? 'default' : 'outline'}>
                    {person.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dates & Financial</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Start Date</dt>
                <dd className="text-sm font-medium">{person.start_date ? formatDate(person.start_date) : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">End Date</dt>
                <dd className="text-sm font-medium">{person.end_date ? formatDate(person.end_date) : '—'}</dd>
              </div>
              {can('canSeeSalary') && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Annual Salary</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {person.annual_salary != null ? formatCurrency(person.annual_salary) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Overhead Rate</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {person.overhead_rate != null ? `${person.overhead_rate}%` : '—'}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
