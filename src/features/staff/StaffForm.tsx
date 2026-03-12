import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { staffService } from '@/services/staffService'
import { settingsService } from '@/services/settingsService'
import { avatarService } from '@/services/avatarService'
import { emailService } from '@/services/emailService'
import { notificationService } from '@/services/notificationService'
import { useAuthStore } from '@/stores/authStore'
import { useStaffMember } from '@/hooks/useStaff'
import { PersonAvatar } from '@/components/common/PersonAvatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Save, Upload, X, Mail, UserPlus, Send } from 'lucide-react'
import { COUNTRIES } from '@/data/countries'
import type { OrgRole } from '@/types'

const ORG_ROLES: OrgRole[] = ['Admin', 'Project Manager', 'Finance Officer', 'Viewer', 'External Participant']

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
  vacation_days_per_year: z.coerce.number().min(0, 'Must be 0 or greater').nullable().optional(),
  country: z.string().max(2).nullable().or(z.literal('')),
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
  const { orgId, orgName, user, can } = useAuthStore()
  const { person, isLoading: loadingPerson, refetch: refetchPerson } = useStaffMember(isEdit ? id : undefined)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inviteToSystem, setInviteToSystem] = useState(false)
  const [inviteRole, setInviteRole] = useState<OrgRole>('Viewer')

  useEffect(() => {
    if (!orgId) return
    settingsService.getOrganisation(orgId).then((org) => {
      if (org?.departments) setDepartments(org.departments)
    }).catch(() => {})
  }, [orgId])

  const {
    register,
    handleSubmit,
    reset,
    control,
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
      vacation_days_per_year: 25,
      country: '',
      is_active: true,
    },
  })

  // Watch email field to conditionally show invite toggle
  const watchedEmail = useWatch({ control, name: 'email' })
  const hasEmail = !!watchedEmail && watchedEmail.includes('@')

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
        vacation_days_per_year: person.vacation_days_per_year ?? 25,
        country: person.country ?? '',
        is_active: person.is_active,
      })
      setExistingAvatarUrl(person.avatar_url ?? null)
    }
  }, [person, reset])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file (JPG, PNG, etc.)', variant: 'destructive' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 2 MB.', variant: 'destructive' })
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
        vacation_days_per_year: data.vacation_days_per_year ?? null,
        country: data.country || null,
        org_id: orgId ?? '',
      }

      let savedPerson: { id: string }
      if (isEdit) {
        // Detect deactivation: was active before, now inactive
        const wasActive = person?.is_active === true
        const nowInactive = data.is_active === false
        await staffService.update(id, payload)
        savedPerson = { id }
        toast({ title: 'Updated', description: `${data.full_name} has been updated.` })

        // Fire-and-forget: notify person if their account was just deactivated
        if (wasActive && nowInactive && data.email && orgId) {
          const orgLabel = orgName ?? 'your organisation'
          emailService.sendStaffDeactivated({
            to: data.email,
            employeeName: data.full_name,
            orgName: orgLabel,
          }).catch(() => {})
        }
      } else {
        const created = await staffService.create(payload as Parameters<typeof staffService.create>[0])
        savedPerson = created
        toast({ title: 'Created', description: `${data.full_name} has been added.` })

        // Send invitation if requested
        if (inviteToSystem && data.email && orgId) {
          try {
            const res = await fetch('/api/invite-member', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: data.email,
                orgId,
                role: inviteRole,
                invitedBy: user?.id,
                personId: created.id,
              }),
            })
            const inviteData = await res.json()
            if (res.ok) {
              toast({ title: 'Invitation sent', description: `${data.email} will receive an invitation email.` })
              // Send branded invitation email
              emailService.sendInvitation({
                invitedEmail: data.email,
                orgName: orgName ?? 'your organisation',
                role: inviteRole,
                invitedByName: user?.email ?? 'An administrator',
                signUpUrl: `${window.location.origin}/signup`,
              }).catch(() => {})
              // Notify admins
              notificationService.getAdminUserIds(orgId).then((adminIds) => {
                notificationService.notifyMany({
                  orgId,
                  userIds: adminIds.filter((uid) => uid !== user?.id),
                  type: 'invitation',
                  title: 'Staff member invited',
                  message: `${data.full_name} (${data.email}) was invited as ${inviteRole}.`,
                  link: '/staff',
                }).catch(() => {})
              }).catch(() => {})
            } else if (res.status === 409) {
              toast({ title: 'Already a member', description: inviteData.error, variant: 'destructive' })
            } else {
              toast({ title: 'Invitation failed', description: inviteData.error ?? 'Could not send invitation', variant: 'destructive' })
            }
          } catch {
            toast({ title: 'Invitation failed', description: 'Could not reach the invitation service.', variant: 'destructive' })
          }
        }
      }

      // Handle avatar upload / removal
      if (avatarFile && orgId) {
        const url = await avatarService.upload(orgId, savedPerson.id, avatarFile)
        await staffService.update(savedPerson.id, { avatar_url: url })
      } else if (removeAvatar && orgId) {
        await avatarService.remove(orgId, savedPerson.id)
        await staffService.update(savedPerson.id, { avatar_url: null })
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
                  <Label htmlFor="department">Department / Team</Label>
                  <select
                    id="department"
                    {...register('department')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role / Title</Label>
                  <Input id="role" {...register('role')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  {...register('country')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
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

              <div className="space-y-2">
                <Label>Photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  {(avatarPreview || (existingAvatarUrl && !removeAvatar)) ? (
                    <div className="relative">
                      <img
                        src={avatarPreview || existingAvatarUrl!}
                        alt="Avatar preview"
                        className="h-14 w-14 rounded-full object-cover border"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground h-5 w-5 flex items-center justify-center hover:bg-destructive/80"
                        title="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <PersonAvatar name={person?.full_name || 'New'} size="md" className="h-14 w-14 text-base" />
                  )}
                  <div className="space-y-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {existingAvatarUrl && !removeAvatar ? 'Change photo' : 'Upload photo'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">JPG, PNG or GIF. Max 2 MB.</p>
                  </div>
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

              <div className="space-y-2">
                <Label htmlFor="vacation_days_per_year">Vacation Days / Year</Label>
                <Input
                  id="vacation_days_per_year"
                  type="number"
                  step="0.5"
                  min="0"
                  {...register('vacation_days_per_year')}
                  placeholder="e.g. 25"
                />
                <p className="text-[11px] text-muted-foreground">Annual leave entitlement in working days</p>
              </div>

              {can('canSeeSalary') && (
                <div className="space-y-2">
                  <Label htmlFor="annual_salary">Annual Salary</Label>
                  <Input
                    id="annual_salary"
                    type="number"
                    step="0.01"
                    {...register('annual_salary')}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Access — only on create, when email is provided */}
          {!isEdit && hasEmail && (
            <Card className="lg:col-span-2 border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  System Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="invite_to_system"
                    checked={inviteToSystem}
                    onChange={(e) => setInviteToSystem(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="invite_to_system" className="font-medium">
                      Invite to GrantLume
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send an invitation email so this person can create an account and access the system.
                    </p>
                  </div>
                </div>

                {inviteToSystem && (
                  <div className="ml-7 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="invite_role">System Role</Label>
                      <select
                        id="invite_role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                        className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        This determines what they can see and do in the system. You can change it later in Settings &gt; Users.
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 px-3 py-2">
                      <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        An invitation email will be sent to <strong>{watchedEmail}</strong> after saving.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edit mode: show current account status */}
          {isEdit && person && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  System Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                {person.user_id ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      Active Account
                    </span>
                    <span className="text-sm text-muted-foreground">This person has a linked GrantLume account.</span>
                  </div>
                ) : person.invite_status === 'pending' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        Invitation Pending
                      </span>
                      <span className="text-sm text-muted-foreground">Invited as {person.invite_role ?? 'Viewer'} — waiting for them to sign up.</span>
                    </div>
                    {person.email && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={inviting}
                        onClick={async () => {
                          if (!orgId || !person.email) return
                          setInviting(true)
                          try {
                            const role: OrgRole = (person.invite_role as OrgRole) ?? 'Viewer'
                            const res = await fetch('/api/invite-member', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: person.email, orgId, role, invitedBy: user?.id, personId: person.id }),
                            })
                            const d = await res.json()
                            if (res.ok || res.status === 409) {
                              emailService.sendInvitation({ invitedEmail: person.email, orgName: orgName ?? 'your organisation', role, invitedByName: user?.email ?? 'An administrator', signUpUrl: `${window.location.origin}/signup` }).catch(() => {})
                              toast({ title: 'Invitation resent', description: `${person.email} will receive a new invitation email.` })
                            } else {
                              toast({ title: 'Failed', description: d.error ?? 'Could not resend invitation', variant: 'destructive' })
                            }
                          } catch {
                            toast({ title: 'Failed', description: 'Could not reach the invitation service.', variant: 'destructive' })
                          } finally {
                            setInviting(false)
                          }
                        }}
                      >
                        <Send className="mr-2 h-3.5 w-3.5" />
                        {inviting ? 'Sending...' : 'Resend Invitation'}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                        No Account
                      </span>
                      <span className="text-sm text-muted-foreground">This person does not have system access.</span>
                    </div>
                    {person.email && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="space-y-2 flex-1 max-w-xs">
                            <Label htmlFor="edit_invite_role">Role</Label>
                            <select
                              id="edit_invite_role"
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {ORG_ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={inviting}
                          onClick={async () => {
                            if (!orgId || !person.email) return
                            setInviting(true)
                            try {
                              const res = await fetch('/api/invite-member', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: person.email, orgId, role: inviteRole, invitedBy: user?.id, personId: person.id }),
                              })
                              const d = await res.json()
                              if (res.ok) {
                                emailService.sendInvitation({ invitedEmail: person.email, orgName: orgName ?? 'your organisation', role: inviteRole, invitedByName: user?.email ?? 'An administrator', signUpUrl: `${window.location.origin}/signup` }).catch(() => {})
                                toast({ title: 'Invitation sent', description: `${person.email} will receive an invitation email.` })
                                refetchPerson()
                              } else if (res.status === 409) {
                                toast({ title: 'Already a member', description: d.error })
                                refetchPerson()
                              } else {
                                toast({ title: 'Failed', description: d.error ?? 'Could not send invitation', variant: 'destructive' })
                              }
                            } catch {
                              toast({ title: 'Failed', description: 'Could not reach the invitation service.', variant: 'destructive' })
                            } finally {
                              setInviting(false)
                            }
                          }}
                        >
                          <Send className="mr-2 h-3.5 w-3.5" />
                          {inviting ? 'Sending...' : 'Invite to GrantLume'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
