import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useStaffMember } from '@/hooks/useStaff'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { absenceService } from '@/services/absenceService'
import { emailService } from '@/services/emailService'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Pencil, Mail, Briefcase, Calendar, DollarSign, MapPin, FolderKanban, CalendarOff, Send } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { COUNTRIES } from '@/data/countries'
import { HOLIDAY_REGIONS } from '@/data/holidayRegions'
import type { OrgRole } from '@/types'

interface PersonProject {
  project: { id: string; acronym: string; title: string; status: string; start_date: string; end_date: string }
  totalPms: number
  isResponsible: boolean
}

export function StaffDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { person, isLoading, refetch } = useStaffMember(id)
  const { orgId, orgName, user, can } = useAuthStore()
  const [projects, setProjects] = useState<PersonProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [absenceDaysUsed, setAbsenceDaysUsed] = useState<number>(0)
  const [inviting, setInviting] = useState(false)
  const currentYear = new Date().getFullYear()

  // Fetch absence days used this year
  useEffect(() => {
    if (!id) return
    absenceService.getPersonAbsenceDays(id, currentYear).then(setAbsenceDaysUsed).catch(() => setAbsenceDaysUsed(0))
  }, [id, currentYear])

  // Fetch projects this person is involved in
  useEffect(() => {
    if (!id || !orgId) return
    setLoadingProjects(true)

    const fetchProjects = async () => {
      try {
        // Get all assignments for this person (across all years)
        const { data: assignments } = await supabase
          .from('assignments')
          .select('project_id, pms')
          .eq('person_id', id)

        // Get projects where this person is responsible
        const { data: responsibleProjects } = await supabase
          .from('projects')
          .select('id, acronym, title, status, start_date, end_date')
          .eq('org_id', orgId)
          .eq('responsible_person_id', id)

        // Get unique project IDs from assignments
        const projectPmsMap = new Map<string, number>()
        for (const a of assignments ?? []) {
          projectPmsMap.set(a.project_id, (projectPmsMap.get(a.project_id) ?? 0) + a.pms)
        }

        // Fetch project details for assigned projects
        const assignedProjectIds = [...projectPmsMap.keys()]
        let assignedProjects: { id: string; acronym: string; title: string; status: string; start_date: string; end_date: string }[] = []
        if (assignedProjectIds.length > 0) {
          const { data } = await supabase
            .from('projects')
            .select('id, acronym, title, status, start_date, end_date')
            .in('id', assignedProjectIds)
          assignedProjects = data ?? []
        }

        // Merge into a single list
        const responsibleIds = new Set((responsibleProjects ?? []).map((p) => p.id))
        const allProjectsMap = new Map<string, PersonProject>()

        for (const p of assignedProjects) {
          allProjectsMap.set(p.id, {
            project: p,
            totalPms: projectPmsMap.get(p.id) ?? 0,
            isResponsible: responsibleIds.has(p.id),
          })
        }

        // Add responsible-only projects (not assigned but responsible)
        for (const p of responsibleProjects ?? []) {
          if (!allProjectsMap.has(p.id)) {
            allProjectsMap.set(p.id, {
              project: p,
              totalPms: 0,
              isResponsible: true,
            })
          }
        }

        setProjects([...allProjectsMap.values()].sort((a, b) => a.project.acronym.localeCompare(b.project.acronym)))
      } catch {
        // Non-critical — just don't show projects
      } finally {
        setLoadingProjects(false)
      }
    }

    fetchProjects()
  }, [id, orgId])

  const countryName = person?.country
    ? COUNTRIES.find((c) => c.code === person.country)?.name ?? person.country
    : null

  const regionName = person?.country && person?.region && HOLIDAY_REGIONS[person.country]
    ? HOLIDAY_REGIONS[person.country][person.region] ?? person.region
    : null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('staff.personNotFound')} />
        <Button variant="outline" onClick={() => navigate('/staff')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('staff.backToStaff')}
        </Button>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    proposal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }

  return (
    <div className="space-y-6">
      {/* Top actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate('/staff')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('staff.backToStaff')}
        </Button>
        <div className="flex gap-2">
          {/* Invite / Re-invite button */}
          {can('canWrite') && person.email && !person.user_id && (
            <Button
              size="sm"
              variant="outline"
              disabled={inviting}
              onClick={async () => {
                if (!orgId || !person.email) return
                setInviting(true)
                try {
                  const role: OrgRole = (person.invite_role as OrgRole) ?? 'Viewer'
                  const res = await fetch('/api/members?action=invite-member', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: person.email,
                      orgId,
                      role,
                      invitedBy: user?.id,
                      personId: person.id,
                    }),
                  })
                  const data = await res.json()
                  if (res.ok) {
                    toast({ title: t('staff.invitationSent'), description: t('staff.invitationSentDesc', { email: person.email }) })
                    emailService.sendInvitation({
                      invitedEmail: person.email,
                      orgName: orgName ?? 'your organisation',
                      role,
                      invitedByName: user?.email ?? 'An administrator',
                      signUpUrl: `${window.location.origin}/signup`,
                    }).catch(() => {})
                    refetch()
                  } else if (res.status === 409) {
                    toast({ title: t('settings.alreadyMember'), description: data.error })
                    refetch()
                  } else {
                    toast({ title: t('staff.invitationFailed'), description: data.error ?? t('staff.couldNotSendInvitation'), variant: 'destructive' })
                  }
                } catch {
                  toast({ title: t('staff.invitationFailed'), description: t('staff.couldNotReachService'), variant: 'destructive' })
                } finally {
                  setInviting(false)
                }
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              {inviting ? t('staff.sending') : person.invite_status === 'pending' ? t('staff.resendInvitation') : t('staff.inviteToGrantLume')}
            </Button>
          )}
          {can('canWrite') && (
            <Button size="sm" onClick={() => navigate(`/staff/${person.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      {/* Hero card with avatar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <PersonAvatar
              name={person.full_name}
              avatarUrl={person.avatar_url}
              size="xl"
            />
            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{person.full_name}</h1>
                <Badge variant={person.is_active ? 'default' : 'outline'} className="w-fit">
                  {person.is_active ? t('staff.active') : t('staff.inactive')}
                </Badge>
                {person.user_id ? (
                  <Badge className="w-fit bg-green-600 hover:bg-green-700 text-[10px]">{t('staff.accountActive')}</Badge>
                ) : person.invite_status === 'pending' ? (
                  <Badge variant="secondary" className="w-fit bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">{t('staff.invitationPending')}</Badge>
                ) : null}
              </div>
              {(person.role || person.department) && (
                <p className="text-muted-foreground mt-1">
                  {[person.role, person.department].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
                {person.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <a href={`mailto:${person.email}`} className="hover:text-foreground transition-colors">{person.email}</a>
                  </span>
                )}
                {person.employment_type && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {person.employment_type} · FTE {person.fte.toFixed(2)}
                  </span>
                )}
                {countryName && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {regionName ? `${regionName}, ${countryName}` : countryName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave balance card */}
      {person.vacation_days_per_year != null && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                <CalendarOff className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-blue-600">{person.vacation_days_per_year}</div>
                  <div className="text-xs text-muted-foreground">{t('staff.entitlementPerYear')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums text-amber-600">{absenceDaysUsed}</div>
                  <div className="text-xs text-muted-foreground">{t('staff.used')} ({currentYear})</div>
                </div>
                <div>
                  <div className={cn(
                    'text-2xl font-bold tabular-nums',
                    (person.vacation_days_per_year - absenceDaysUsed) <= 0 ? 'text-red-600' :
                    (person.vacation_days_per_year - absenceDaysUsed) <= 5 ? 'text-amber-600' : 'text-emerald-600'
                  )}>
                    {person.vacation_days_per_year - absenceDaysUsed}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('common.remaining')}</div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-24 hidden sm:block">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      (absenceDaysUsed / person.vacation_days_per_year) >= 1 ? 'bg-red-500' :
                      (absenceDaysUsed / person.vacation_days_per_year) >= 0.8 ? 'bg-amber-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${Math.min(100, (absenceDaysUsed / person.vacation_days_per_year) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground text-center mt-1">
                  {Math.round((absenceDaysUsed / person.vacation_days_per_year) * 100)}% {t('staff.used')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Employment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              {t('staff.employment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label={t('common.type')} value={person.employment_type} />
              <InfoRow label="FTE" value={person.fte.toFixed(2)} />
              <InfoRow label={t('staff.department')} value={person.department} />
              <InfoRow label={t('staff.role')} value={person.role} />
              {countryName && <InfoRow label={t('staff.country')} value={countryName} />}
              {regionName && <InfoRow label={t('staff.region')} value={regionName} />}
            </dl>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {t('staff.dates')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label={t('staff.startDate')} value={person.start_date ? formatDate(person.start_date) : null} />
              <InfoRow label={t('staff.endDate')} value={person.end_date ? formatDate(person.end_date) : null} />
              {person.start_date && (
                <InfoRow
                  label={t('staff.tenure')}
                  value={getTenure(person.start_date, person.end_date)}
                />
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Financial (if permitted) */}
        {can('canSeeSalary') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {t('staff.financial')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <InfoRow
                  label={t('staff.annualSalary')}
                  value={person.annual_salary != null ? formatCurrency(person.annual_salary) : null}
                />
                <InfoRow
                  label={t('staff.overheadRate')}
                  value={person.overhead_rate != null ? `${person.overhead_rate}%` : null}
                />
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Projects involved */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            {t('common.projects')} ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProjects ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('staff.noProjectInvolvement')}
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">{t('common.project')}</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">{t('common.period')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('common.status')}</th>
                    <th className="px-3 py-2 text-right font-medium">PMs</th>
                    <th className="px-3 py-2 text-left font-medium">{t('staff.role')}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((pp) => (
                    <tr
                      key={pp.project.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/projects/${pp.project.id}`)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{pp.project.acronym}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{pp.project.title}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {formatDate(pp.project.start_date)} – {formatDate(pp.project.end_date)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          statusColors[pp.project.status] ?? 'bg-gray-100 text-gray-600'
                        )}>
                          {pp.project.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {pp.totalPms > 0 ? pp.totalPms.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {pp.isResponsible && (
                          <Badge variant="secondary" className="text-xs">{t('common.lead')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="font-medium text-right">{value ?? '—'}</dd>
    </div>
  )
}

function getTenure(start: string, end: string | null): string {
  const from = new Date(start)
  const to = end ? new Date(end) : new Date()
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0) return `${rem} month${rem !== 1 ? 's' : ''}`
  if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years}y ${rem}m`
}
