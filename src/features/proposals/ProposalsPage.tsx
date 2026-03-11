import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { proposalService } from '@/services/proposalService'
import { generateProposalsPipelinePDF } from '@/services/reportGenerator'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightCircle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Download,
} from 'lucide-react'
import type { Proposal, ProposalStatus } from '@/types'

const STATUS_OPTIONS: ProposalStatus[] = ['In Preparation', 'Submitted', 'Rejected', 'Granted']

const STATUS_CONFIG: Record<ProposalStatus, { color: string; bg: string; icon: typeof Clock }> = {
  'In Preparation': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
  'Submitted': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Send },
  'Granted': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  'Rejected': { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
}

const EMPTY_FORM = {
  project_name: '',
  call_identifier: '',
  funding_scheme: '',
  submission_deadline: '',
  expected_decision: '',
  our_pms: 0,
  personnel_budget: 0,
  travel_budget: 0,
  subcontracting_budget: 0,
  other_budget: 0,
  status: 'In Preparation' as ProposalStatus,
  notes: '',
}

export function ProposalsPage() {
  const navigate = useNavigate()
  const { orgId, user } = useAuthStore()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null)
  const [convertTarget, setConvertTarget] = useState<Proposal | null>(null)
  const [converting, setConverting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | 'All'>('All')
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchProposals = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await proposalService.list(orgId)
      setProposals(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load proposals'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProposals()
  }, [orgId])

  const filtered = useMemo(() => {
    if (filterStatus === 'All') return proposals
    return proposals.filter((p) => p.status === filterStatus)
  }, [proposals, filterStatus])

  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STATUS_OPTIONS) counts[s] = 0
    for (const p of proposals) counts[p.status] = (counts[p.status] ?? 0) + 1
    const totalBudget = proposals.reduce(
      (sum, p) => sum + p.personnel_budget + p.travel_budget + p.subcontracting_budget + p.other_budget,
      0,
    )
    return { counts, totalBudget, total: proposals.length }
  }, [proposals])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (p: Proposal) => {
    setEditingId(p.id)
    setForm({
      project_name: p.project_name,
      call_identifier: p.call_identifier,
      funding_scheme: p.funding_scheme,
      submission_deadline: p.submission_deadline ?? '',
      expected_decision: p.expected_decision ?? '',
      our_pms: p.our_pms,
      personnel_budget: p.personnel_budget,
      travel_budget: p.travel_budget,
      subcontracting_budget: p.subcontracting_budget,
      other_budget: p.other_budget,
      status: p.status,
      notes: p.notes ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!orgId || !form.project_name.trim()) {
      toast({ title: 'Project name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        org_id: orgId,
        project_name: form.project_name.trim(),
        call_identifier: form.call_identifier.trim(),
        funding_scheme: form.funding_scheme.trim(),
        submission_deadline: form.submission_deadline || null,
        expected_decision: form.expected_decision || null,
        our_pms: Number(form.our_pms) || 0,
        personnel_budget: Number(form.personnel_budget) || 0,
        travel_budget: Number(form.travel_budget) || 0,
        subcontracting_budget: Number(form.subcontracting_budget) || 0,
        other_budget: Number(form.other_budget) || 0,
        status: form.status,
        notes: form.notes.trim() || null,
        created_by: user?.id ?? null,
      }

      if (editingId) {
        await proposalService.update(editingId, payload)
        toast({ title: 'Proposal updated' })
      } else {
        await proposalService.create(payload)
        toast({ title: 'Proposal created' })
      }
      setDialogOpen(false)
      fetchProposals()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await proposalService.remove(deleteTarget.id)
      toast({ title: 'Proposal deleted' })
      setDeleteTarget(null)
      fetchProposals()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleConvert = async () => {
    if (!convertTarget || !orgId || !user?.id) return
    setConverting(true)
    try {
      const projectId = await proposalService.convertToProject(convertTarget, orgId, user.id)
      toast({ title: 'Project created!', description: 'Redirecting to the new project...' })
      setConvertTarget(null)
      navigate(`/projects/${projectId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to convert'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setConverting(false)
    }
  }

  const setField = (key: string, value: string | number) => setForm((f) => ({ ...f, [key]: value }))

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Proposals" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Track grant proposal applications and convert granted ones into projects"
        actions={
          <div className="flex gap-2">
            {proposals.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => generateProposalsPipelinePDF(proposals, '')}
              >
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            )}
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Proposal
            </Button>
          </div>
        }
      />

      {/* Pipeline Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground', filter: 'All' as const },
          ...STATUS_OPTIONS.map((s) => ({
            label: s,
            value: stats.counts[s],
            color: STATUS_CONFIG[s].color,
            filter: s,
          })),
        ].map((item) => (
          <Card
            key={item.label}
            className={`cursor-pointer transition-all ${filterStatus === item.filter ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setFilterStatus(item.filter)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proposals Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filterStatus === 'All' ? 'All Proposals' : `${filterStatus} Proposals`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No proposals found</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Add your first proposal
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Project Name</th>
                    <th className="px-3 py-2 text-left font-medium">Call</th>
                    <th className="px-3 py-2 text-left font-medium">Scheme</th>
                    <th className="px-3 py-2 text-left font-medium">Deadline</th>
                    <th className="px-3 py-2 text-left font-medium">Decision</th>
                    <th className="px-3 py-2 text-right font-medium">PMs</th>
                    <th className="px-3 py-2 text-right font-medium">Total Budget</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const total = p.personnel_budget + p.travel_budget + p.subcontracting_budget + p.other_budget
                    const cfg = STATUS_CONFIG[p.status]
                    const StatusIcon = cfg.icon
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium max-w-[200px]">
                          <div className="truncate" title={p.project_name}>{p.project_name}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[180px]">
                          <div className="truncate" title={p.call_identifier}>{p.call_identifier || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px]">
                          <div className="truncate" title={p.funding_scheme}>{p.funding_scheme || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {p.submission_deadline
                            ? new Date(p.submission_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {p.expected_decision
                            ? new Date(p.expected_decision).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.our_pms > 0 ? p.our_pms : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{total > 0 ? formatCurrency(total) : '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline" className={`${cfg.bg} ${cfg.color} border gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {p.status === 'Granted' && !p.converted_project_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => setConvertTarget(p)}
                                title="Convert to Project"
                              >
                                <ArrowRightCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {p.converted_project_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary"
                                onClick={() => navigate(`/projects/${p.converted_project_id}`)}
                                title="Go to Project"
                              >
                                <ArrowRightCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteTarget(p)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Proposal' : 'New Proposal'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the proposal details below.' : 'Enter the details of your grant proposal application.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Project Name *</Label>
                <Input value={form.project_name} onChange={(e) => setField('project_name', e.target.value)} placeholder="e.g. AI-Enhanced Grant Management" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Call Identifier</Label>
                <Input value={form.call_identifier} onChange={(e) => setField('call_identifier', e.target.value)} placeholder="e.g. HORIZON-CL4-2025-DATA-01-06" />
              </div>
              <div className="space-y-2">
                <Label>Funding Scheme</Label>
                <Input value={form.funding_scheme} onChange={(e) => setField('funding_scheme', e.target.value)} placeholder="e.g. Research and Innovation Action" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Submission Deadline</Label>
                <Input type="date" value={form.submission_deadline} onChange={(e) => setField('submission_deadline', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Approx. Decision Date</Label>
                <Input type="date" value={form.expected_decision} onChange={(e) => setField('expected_decision', e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Budget Breakdown</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Our PMs</Label>
                  <Input type="number" step="0.5" min="0" value={form.our_pms || ''} onChange={(e) => setField('our_pms', e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Personnel Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.personnel_budget || ''} onChange={(e) => setField('personnel_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Travel Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.travel_budget || ''} onChange={(e) => setField('travel_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Subcontracting Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.subcontracting_budget || ''} onChange={(e) => setField('subcontracting_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Other Budget</Label>
                  <Input type="number" step="0.01" min="0" value={form.other_budget || ''} onChange={(e) => setField('other_budget', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Total Budget</Label>
                  <Input
                    value={formatCurrency(
                      (Number(form.personnel_budget) || 0) +
                      (Number(form.travel_budget) || 0) +
                      (Number(form.subcontracting_budget) || 0) +
                      (Number(form.other_budget) || 0)
                    )}
                    disabled
                    className="bg-muted font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Any additional notes about this proposal..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Proposal' : 'Create Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title="Delete Proposal"
        message={`Are you sure you want to delete "${deleteTarget?.project_name}"? This cannot be undone.`}
        destructive
      />

      {/* Convert to Project Confirmation */}
      <ConfirmModal
        open={!!convertTarget}
        onOpenChange={(open) => { if (!open) setConvertTarget(null) }}
        onConfirm={handleConvert}
        title="Convert to Project"
        message={`This will create a new project from "${convertTarget?.project_name}" with the proposal's budget data. You can then edit the project details. Continue?`}
        confirmLabel={converting ? 'Converting...' : 'Create Project'}
        loading={converting}
      />
    </div>
  )
}
