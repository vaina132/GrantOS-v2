import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, FileText, Calendar, Rocket, Trash2, Send, Copy, Check, Mail, Plus, Pencil } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { collabProjectService, collabPartnerService, collabWpService, collabPeriodService, collabReportService } from '@/services/collabProjectService'
import { emailService } from '@/services/emailService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { EditPartnerDialog } from './EditPartnerDialog'
import { EditWpDialog } from './EditWpDialog'
import type { CollabProject, CollabPartner, CollabWorkPackage, CollabReportingPeriod, CollabReport } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const INVITE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  declined: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
}

export function CollabProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orgName, user } = useAuthStore()
  const [project, setProject] = useState<CollabProject | null>(null)
  const [partners, setPartners] = useState<CollabPartner[]>([])
  const [wps, setWps] = useState<CollabWorkPackage[]>([])
  const [periods, setPeriods] = useState<CollabReportingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingInvites, setSendingInvites] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Edit dialogs
  const [editPartner, setEditPartner] = useState<CollabPartner | null>(null)
  const [showPartnerDialog, setShowPartnerDialog] = useState(false)
  const [showWpDialog, setShowWpDialog] = useState(false)

  // Period reports
  const [periodReports, setPeriodReports] = useState<Record<string, CollabReport[]>>({})
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)

  // Add period form
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ title: '', period_type: 'informal' as 'formal' | 'informal', start_month: '', end_month: '', due_date: '' })

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [proj, parts, workPackages, rPeriods] = await Promise.all([
        collabProjectService.get(id),
        collabPartnerService.list(id),
        collabWpService.list(id),
        collabPeriodService.list(id),
      ])
      setProject(proj)
      setPartners(parts)
      setWps(workPackages)
      setPeriods(rPeriods)
    } catch {
      toast({ title: 'Error', description: 'Failed to load project', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleLaunch = async () => {
    if (!id || !confirm('Launch this project? Status will change to Active.')) return
    try {
      await collabProjectService.launch(id)
      toast({ title: 'Launched', description: 'Project is now active' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to launch', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('Delete this collaboration project? This cannot be undone.')) return
    try {
      await collabProjectService.remove(id)
      toast({ title: 'Deleted' })
      navigate('/projects/collaboration')
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' })
    }
  }

  const getInviteUrl = (p: CollabPartner) => {
    const base = window.location.origin
    return `${base}/collab/accept?token=${p.invite_token}`
  }

  const handleCopyLink = async (p: CollabPartner) => {
    try {
      await navigator.clipboard.writeText(getInviteUrl(p))
      setCopiedId(p.id)
      setTimeout(() => setCopiedId(null), 2000)
      toast({ title: 'Copied', description: `Invite link for ${p.org_name} copied to clipboard` })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' })
    }
  }

  const handleSendInvite = async (p: CollabPartner) => {
    if (!project || !p.contact_email) return
    try {
      await emailService.sendCollabPartnerInvitation({
        to: p.contact_email,
        contactName: p.contact_name || '',
        orgName: p.org_name,
        projectAcronym: project.acronym,
        projectTitle: project.title,
        coordinatorOrg: orgName || 'Coordinator',
        senderName: user?.email || 'Coordinator',
        role: p.role,
        acceptUrl: getInviteUrl(p),
      })
      toast({ title: 'Sent', description: `Invitation sent to ${p.contact_email}` })
    } catch {
      toast({ title: 'Error', description: 'Failed to send invitation email', variant: 'destructive' })
    }
  }

  const handleSendAllInvites = async () => {
    if (!project) return
    const pending = partners.filter(p => p.invite_status === 'pending' && p.contact_email)
    if (pending.length === 0) {
      toast({ title: 'No pending invitations', description: 'All partners with emails have already been invited or accepted.' })
      return
    }
    setSendingInvites(true)
    let sent = 0
    for (const p of pending) {
      try {
        await emailService.sendCollabPartnerInvitation({
          to: p.contact_email!,
          contactName: p.contact_name || '',
          orgName: p.org_name,
          projectAcronym: project.acronym,
          projectTitle: project.title,
          coordinatorOrg: orgName || 'Coordinator',
          senderName: user?.email || 'Coordinator',
          role: p.role,
          acceptUrl: getInviteUrl(p),
        })
        sent++
      } catch {
        // continue sending to others
      }
    }
    setSendingInvites(false)
    toast({ title: 'Invitations sent', description: `Sent ${sent} of ${pending.length} invitation email(s)` })
  }

  const handleAddPeriod = async () => {
    if (!id || !newPeriod.title || !newPeriod.start_month || !newPeriod.end_month) return
    try {
      await collabPeriodService.create({
        project_id: id,
        period_type: newPeriod.period_type,
        title: newPeriod.title,
        start_month: parseInt(newPeriod.start_month),
        end_month: parseInt(newPeriod.end_month),
        due_date: newPeriod.due_date || undefined,
      })
      toast({ title: 'Created', description: 'Reporting period added' })
      setShowAddPeriod(false)
      setNewPeriod({ title: '', period_type: 'informal', start_month: '', end_month: '', due_date: '' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to create period', variant: 'destructive' })
    }
  }

  const handleGenerateReports = async (periodId: string) => {
    if (!id || !confirm('Generate reports for all partners in this period?')) return
    try {
      await collabPeriodService.generateReports(periodId, id)
      toast({ title: 'Generated', description: 'Reports created for all partners' })
      load()
      // Auto-expand to show generated reports
      await loadPeriodReports(periodId)
      setExpandedPeriod(periodId)
    } catch {
      toast({ title: 'Error', description: 'Failed to generate reports', variant: 'destructive' })
    }
  }

  const loadPeriodReports = async (periodId: string) => {
    try {
      const reports = await collabReportService.listForPeriod(periodId)
      setPeriodReports(prev => ({ ...prev, [periodId]: reports }))
    } catch {
      toast({ title: 'Error', description: 'Failed to load reports', variant: 'destructive' })
    }
  }

  const togglePeriod = async (periodId: string) => {
    if (expandedPeriod === periodId) {
      setExpandedPeriod(null)
      return
    }
    setExpandedPeriod(periodId)
    if (!periodReports[periodId]) {
      await loadPeriodReports(periodId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Project not found</p>
        <Button variant="link" onClick={() => navigate('/projects/collaboration')}>Back to list</Button>
      </div>
    )
  }

  const totalBudget = partners.reduce((sum, p) =>
    sum + p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
  , 0)
  const totalPMs = partners.reduce((sum, p) => sum + p.total_person_months, 0)
  const pendingCount = partners.filter(p => p.invite_status === 'pending').length
  const acceptedCount = partners.filter(p => p.invite_status === 'accepted').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects/collaboration')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.acronym}</h1>
              <Badge className={STATUS_COLORS[project.status] ?? ''} variant="secondary">
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{project.title}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
              {project.grant_number && <span>GA {project.grant_number}</span>}
              {project.funding_programme && <span>{project.funding_programme}</span>}
              {project.start_date && project.end_date && (
                <span>{project.start_date} → {project.end_date}</span>
              )}
              {project.duration_months && <span>{project.duration_months} months</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <Button variant="outline" onClick={handleSendAllInvites} disabled={sendingInvites} className="gap-2">
              <Send className="h-4 w-4" />
              {sendingInvites ? 'Sending...' : `Invite All (${pendingCount})`}
            </Button>
          )}
          {project.status === 'draft' && (
            <Button onClick={handleLaunch} className="gap-2">
              <Rocket className="h-4 w-4" /> Launch
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{partners.length}</p>
            <p className="text-xs text-muted-foreground">Partners</p>
            <p className="text-[10px] text-muted-foreground">{acceptedCount} accepted · {pendingCount} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{wps.length}</p>
            <p className="text-xs text-muted-foreground">Work Packages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalPMs.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Person-Months</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">€{totalBudget.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Budget</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="partners">
        <TabsList>
          <TabsTrigger value="partners" className="gap-2">
            <Users className="h-4 w-4" /> Partners
          </TabsTrigger>
          <TabsTrigger value="wps" className="gap-2">
            <FileText className="h-4 w-4" /> Work Packages
          </TabsTrigger>
          <TabsTrigger value="periods" className="gap-2">
            <Calendar className="h-4 w-4" /> Reporting Periods
          </TabsTrigger>
        </TabsList>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setEditPartner(null); setShowPartnerDialog(true) }} className="gap-2">
              <Plus className="h-4 w-4" /> Add Partner
            </Button>
          </div>
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No partners added yet</p>
          ) : (
            <div className="space-y-3">
              {partners.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={p.role === 'coordinator' ? 'default' : 'secondary'}>
                            {p.role === 'coordinator' ? 'Coordinator' : `#${p.participant_number}`}
                          </Badge>
                          <span className="font-medium">{p.org_name}</span>
                          <Badge variant="outline" className={`text-[10px] ${INVITE_STATUS_COLORS[p.invite_status] ?? ''}`}>
                            {p.invite_status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
                          {p.contact_name && <span>{p.contact_name}</span>}
                          {p.contact_email && <span>{p.contact_email}</span>}
                          <span>{p.total_person_months} PMs</span>
                          <span>€{(p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods).toLocaleString()}</span>
                          <span>Funding: {p.funding_rate}%</span>
                          <span>Indirect: {p.indirect_cost_rate}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditPartner(p); setShowPartnerDialog(true) }}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        {p.invite_status === 'pending' && p.contact_email && (
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendInvite(p)}>
                            <Mail className="h-3.5 w-3.5" /> Email
                          </Button>
                        )}
                        {p.invite_token && (
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleCopyLink(p)}>
                            {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedId === p.id ? 'Copied' : 'Link'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Work Packages Tab */}
        <TabsContent value="wps" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowWpDialog(true)} className="gap-2">
              <Pencil className="h-4 w-4" /> Edit Work Packages
            </Button>
          </div>
          {wps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No work packages defined</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium w-20">WP #</th>
                      <th className="p-3 font-medium">Title</th>
                      <th className="p-3 font-medium text-right w-28">Person-Months</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wps.map(wp => (
                      <tr key={wp.id} className="border-b last:border-0">
                        <td className="p-3 font-mono">{wp.wp_number}</td>
                        <td className="p-3">{wp.title}</td>
                        <td className="p-3 text-right">{wp.total_person_months}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-medium">
                      <td className="p-3" colSpan={2}>Total</td>
                      <td className="p-3 text-right">
                        {wps.reduce((sum, w) => sum + w.total_person_months, 0).toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reporting Periods Tab */}
        <TabsContent value="periods" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {periods.length} period{periods.length !== 1 ? 's' : ''} configured
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowAddPeriod(!showAddPeriod)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Period
            </Button>
          </div>

          {showAddPeriod && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Title *</Label>
                    <Input value={newPeriod.title} onChange={e => setNewPeriod(p => ({ ...p, title: e.target.value }))} placeholder="e.g. RP1" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <select value={newPeriod.period_type} onChange={e => setNewPeriod(p => ({ ...p, period_type: e.target.value as any }))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                      <option value="informal">Informal</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Month *</Label>
                    <Input type="number" value={newPeriod.start_month} onChange={e => setNewPeriod(p => ({ ...p, start_month: e.target.value }))} placeholder="1" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Month *</Label>
                    <Input type="number" value={newPeriod.end_month} onChange={e => setNewPeriod(p => ({ ...p, end_month: e.target.value }))} placeholder="18" className="h-9 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Due Date</Label>
                    <Input type="date" value={newPeriod.due_date} onChange={e => setNewPeriod(p => ({ ...p, due_date: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-3 flex items-end gap-2">
                    <Button size="sm" onClick={handleAddPeriod} disabled={!newPeriod.title || !newPeriod.start_month || !newPeriod.end_month}>
                      Add Period
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddPeriod(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {periods.length === 0 && !showAddPeriod ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-2">No reporting periods configured</p>
              <p className="text-xs text-muted-foreground">
                Add periods to start tracking partner financial reports.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map(p => {
                const isExpanded = expandedPeriod === p.id
                const reports = periodReports[p.id] ?? []
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <button className="text-left flex-1" onClick={() => p.reports_generated && togglePeriod(p.id)}>
                          <div className="flex items-center gap-2">
                            <Badge variant={p.period_type === 'formal' ? 'default' : 'secondary'}>
                              {p.period_type}
                            </Badge>
                            <span className="font-medium">{p.title}</span>
                            {p.reports_generated && (
                              <span className="text-xs text-muted-foreground">
                                {isExpanded ? '▾' : '▸'} {reports.length || ''} reports
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Month {p.start_month} – {p.end_month}
                            {p.due_date && ` · Due: ${p.due_date}`}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          {p.reports_generated ? (
                            <Button size="sm" variant="ghost" onClick={() => togglePeriod(p.id)} className="gap-1.5 text-xs">
                              <FileText className="h-3.5 w-3.5" /> {isExpanded ? 'Hide' : 'View'} Reports
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleGenerateReports(p.id)} className="gap-1.5 text-xs">
                              <FileText className="h-3.5 w-3.5" /> Generate Reports
                            </Button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-1.5">
                          {reports.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Loading reports...</p>
                          ) : (
                            reports.map(r => {
                              const rPartner = (r as any).collab_partners
                              const statusColor: Record<string, string> = {
                                draft: 'bg-slate-100 text-slate-700',
                                submitted: 'bg-blue-100 text-blue-800',
                                approved: 'bg-emerald-100 text-emerald-800',
                                rejected: 'bg-red-100 text-red-800',
                              }
                              return (
                                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {rPartner?.org_name ?? `Partner #${rPartner?.participant_number ?? '?'}`}
                                    </span>
                                    <Badge variant="outline" className={`text-[10px] ${statusColor[r.status] ?? ''}`}>
                                      {r.status}
                                    </Badge>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => navigate(`/projects/collaboration/report/${r.id}`)}
                                  >
                                    {r.status === 'submitted' ? 'Review' : 'Open'}
                                  </Button>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <EditPartnerDialog
        partner={editPartner}
        projectId={id!}
        open={showPartnerDialog}
        onClose={() => setShowPartnerDialog(false)}
        onSaved={load}
      />
      <EditWpDialog
        projectId={id!}
        existing={wps}
        open={showWpDialog}
        onClose={() => setShowWpDialog(false)}
        onSaved={load}
      />
    </div>
  )
}
