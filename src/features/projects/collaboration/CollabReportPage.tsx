import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, CheckCircle, XCircle, RotateCcw, Clock, Plus, Trash2, Save } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { collabReportService, collabLineService } from '@/services/collabProjectService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import type { CollabReport, CollabReportLine, CollabReportSection } from '@/types'

const REPORT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const SECTIONS: { key: CollabReportSection; label: string }[] = [
  { key: 'personnel_effort', label: 'Personnel Effort (PMs)' },
  { key: 'personnel_costs', label: 'Personnel Costs' },
  { key: 'subcontracting', label: 'Subcontracting' },
  { key: 'travel', label: 'Travel & Subsistence' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'other_goods', label: 'Other Goods & Services' },
]

export function CollabReportPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [report, setReport] = useState<CollabReport | null>(null)
  const [lines, setLines] = useState<CollabReportLine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  // Editable line data — keyed by line ID
  const [editData, setEditData] = useState<Record<string, { amount: string; justification: string }>>({})
  // New lines to add
  const [newLines, setNewLines] = useState<{ section: CollabReportSection; wp_id: string; amount: string; justification: string }[]>([])

  const load = async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const [r, l] = await Promise.all([
        collabReportService.get(reportId),
        collabLineService.list(reportId),
      ])
      setReport(r)
      setLines(l)
      // Initialize edit data
      const ed: Record<string, { amount: string; justification: string }> = {}
      for (const line of l) {
        ed[line.id] = {
          amount: String(line.data?.amount ?? ''),
          justification: line.justification || '',
        }
      }
      setEditData(ed)
    } catch {
      toast({ title: 'Error', description: 'Failed to load report', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [reportId])

  const canEdit = report?.status === 'draft' || report?.status === 'rejected'
  const canSubmit = canEdit && lines.length > 0
  const canReview = report?.status === 'submitted'

  const handleSaveLine = async (lineId: string) => {
    const ed = editData[lineId]
    if (!ed) return
    setSaving(true)
    try {
      await collabLineService.upsert({
        id: lineId,
        report_id: reportId!,
        section: lines.find(l => l.id === lineId)?.section ?? 'personnel_costs',
        data: { amount: parseFloat(ed.amount) || 0 },
        justification: ed.justification || null,
      })
      toast({ title: 'Saved' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    let saved = 0
    try {
      // Save existing lines
      for (const line of lines) {
        const ed = editData[line.id]
        if (!ed) continue
        await collabLineService.upsert({
          id: line.id,
          report_id: reportId!,
          section: line.section,
          data: { amount: parseFloat(ed.amount) || 0 },
          justification: ed.justification || null,
        })
        saved++
      }
      // Save new lines
      for (const nl of newLines) {
        if (!nl.amount && !nl.justification) continue
        await collabLineService.upsert({
          report_id: reportId!,
          section: nl.section,
          wp_id: nl.wp_id || null,
          data: { amount: parseFloat(nl.amount) || 0 },
          justification: nl.justification || null,
          line_order: lines.filter(l => l.section === nl.section).length + 1,
        })
        saved++
      }
      setNewLines([])
      toast({ title: 'Saved', description: `${saved} line(s) saved` })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to save lines', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm('Remove this line?')) return
    try {
      await collabLineService.remove(lineId)
      toast({ title: 'Removed' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (!reportId || !confirm('Submit this report for review? You can still make changes if it is returned.')) return
    try {
      await handleSaveAll()
      await collabReportService.submit(reportId, user?.email || 'Partner')
      toast({ title: 'Submitted', description: 'Report sent for coordinator review' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to submit', variant: 'destructive' })
    }
  }

  const handleResubmit = async () => {
    if (!reportId || !confirm('Resubmit this report?')) return
    try {
      await handleSaveAll()
      await collabReportService.resubmit(reportId, user?.email || 'Partner')
      toast({ title: 'Resubmitted', description: 'Report sent back for review' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to resubmit', variant: 'destructive' })
    }
  }

  const handleApprove = async () => {
    if (!reportId || !user || !confirm('Approve this report?')) return
    try {
      await collabReportService.approve(reportId, user.id, user.email || 'Coordinator')
      toast({ title: 'Approved' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' })
    }
  }

  const handleReject = async () => {
    if (!reportId || !user || !rejectionNote.trim()) return
    try {
      await collabReportService.reject(reportId, user.id, user.email || 'Coordinator', rejectionNote.trim())
      toast({ title: 'Returned', description: 'Report returned to partner for corrections' })
      setShowRejectForm(false)
      setRejectionNote('')
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to reject', variant: 'destructive' })
    }
  }

  const addNewLine = (section: CollabReportSection) => {
    setNewLines([...newLines, { section, wp_id: '', amount: '', justification: '' }])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Report not found</p>
        <Button variant="link" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    )
  }

  const partnerName = report.partner?.org_name ?? 'Partner'
  const periodTitle = report.period?.title ?? 'Period'
  const projectId = report.period?.project_id

  // Group lines by section
  const linesBySection: Record<string, CollabReportLine[]> = {}
  for (const s of SECTIONS) {
    linesBySection[s.key] = lines.filter(l => l.section === s.key)
  }

  // Compute totals per section
  const sectionTotals: Record<string, number> = {}
  for (const s of SECTIONS) {
    sectionTotals[s.key] = linesBySection[s.key].reduce((sum, l) => {
      const ed = editData[l.id]
      return sum + (parseFloat(ed?.amount || '0') || 0)
    }, 0)
  }
  const grandTotal = Object.values(sectionTotals).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => projectId ? navigate(`/projects/collaboration/${projectId}`) : navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{partnerName}</h1>
              <Badge className={REPORT_STATUS_COLORS[report.status] ?? ''} variant="secondary">
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Financial Report — {periodTitle}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
              {report.submitted_at && <span>Submitted: {new Date(report.submitted_at).toLocaleDateString()}</span>}
              {report.reviewed_at && <span>Reviewed: {new Date(report.reviewed_at).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <>
              <Button variant="outline" onClick={handleSaveAll} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save All'}
              </Button>
              {report.status === 'draft' && canSubmit && (
                <Button onClick={handleSubmit} className="gap-2">
                  <Send className="h-4 w-4" /> Submit
                </Button>
              )}
              {report.status === 'rejected' && (
                <Button onClick={handleResubmit} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Resubmit
                </Button>
              )}
            </>
          )}
          {canReview && (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(!showRejectForm)} className="gap-2 text-destructive border-destructive/30">
                <XCircle className="h-4 w-4" /> Return
              </Button>
              <Button onClick={handleApprove} className="gap-2">
                <CheckCircle className="h-4 w-4" /> Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Rejection note banner */}
      {report.rejection_note && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive mb-1">Corrections Requested</p>
            <p className="text-sm">{report.rejection_note}</p>
          </CardContent>
        </Card>
      )}

      {/* Reject form (coordinator) */}
      {showRejectForm && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-medium">Reason for returning report</Label>
            <textarea
              value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              placeholder="Describe what needs to be corrected..."
            />
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleReject} disabled={!rejectionNote.trim()}>
                Return Report
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowRejectForm(false); setRejectionNote('') }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{lines.length}</p>
            <p className="text-xs text-muted-foreground">Cost Lines</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">€{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">Total Reported</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{sectionTotals.personnel_effort?.toFixed(1) || '0.0'}</p>
            <p className="text-xs text-muted-foreground">Person-Months</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{report.status}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current Status</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost sections */}
      <Tabs defaultValue="personnel_costs">
        <TabsList className="flex-wrap h-auto gap-1">
          {SECTIONS.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="text-xs">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map(s => {
          const sectionLines = linesBySection[s.key]
          const sectionNewLines = newLines.filter(nl => nl.section === s.key)

          return (
            <TabsContent key={s.key} value={s.key} className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Subtotal: €{sectionTotals[s.key]?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => addNewLine(s.key)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Line
                  </Button>
                )}
              </div>

              {sectionLines.length === 0 && sectionNewLines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No entries yet</p>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-3 font-medium w-16">#</th>
                          <th className="p-3 font-medium">WP</th>
                          <th className="p-3 font-medium w-40">Amount (€)</th>
                          <th className="p-3 font-medium">Justification</th>
                          {canEdit && <th className="p-3 font-medium w-20"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sectionLines.map((line, idx) => {
                          const ed = editData[line.id] ?? { amount: '', justification: '' }
                          return (
                            <tr key={line.id} className="border-b last:border-0">
                              <td className="p-3 text-muted-foreground">{idx + 1}</td>
                              <td className="p-3 text-xs">{line.work_package?.title || '—'}</td>
                              <td className="p-3">
                                {canEdit ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={ed.amount}
                                    onChange={e => setEditData(d => ({ ...d, [line.id]: { ...ed, amount: e.target.value } }))}
                                    className="h-8 text-sm w-full"
                                  />
                                ) : (
                                  <span>€{parseFloat(ed.amount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                )}
                              </td>
                              <td className="p-3">
                                {canEdit ? (
                                  <Input
                                    value={ed.justification}
                                    onChange={e => setEditData(d => ({ ...d, [line.id]: { ...ed, justification: e.target.value } }))}
                                    className="h-8 text-sm w-full"
                                    placeholder="Optional note"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">{ed.justification || '—'}</span>
                                )}
                              </td>
                              {canEdit && (
                                <td className="p-3">
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveLine(line.id)}>
                                      <Save className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLine(line.id)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                        {sectionNewLines.map((nl, idx) => {
                          const globalIdx = newLines.indexOf(nl)
                          return (
                            <tr key={`new-${idx}`} className="border-b last:border-0 bg-primary/5">
                              <td className="p-3 text-muted-foreground text-xs">new</td>
                              <td className="p-3 text-xs">—</td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={nl.amount}
                                  onChange={e => {
                                    const updated = [...newLines]
                                    updated[globalIdx] = { ...nl, amount: e.target.value }
                                    setNewLines(updated)
                                  }}
                                  className="h-8 text-sm w-full"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="p-3">
                                <Input
                                  value={nl.justification}
                                  onChange={e => {
                                    const updated = [...newLines]
                                    updated[globalIdx] = { ...nl, justification: e.target.value }
                                    setNewLines(updated)
                                  }}
                                  className="h-8 text-sm w-full"
                                  placeholder="Justification"
                                />
                              </td>
                              {canEdit && (
                                <td className="p-3">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNewLines(newLines.filter((_, i) => i !== globalIdx))}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Activity log */}
      {report.events && report.events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {report.events.map(ev => (
                <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {ev.event_type === 'approved' && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                    {ev.event_type === 'rejected' && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    {ev.event_type === 'submitted' && <Send className="h-3.5 w-3.5 text-blue-600" />}
                    {ev.event_type === 'resubmitted' && <RotateCcw className="h-3.5 w-3.5 text-blue-600" />}
                    {!['approved', 'rejected', 'submitted', 'resubmitted'].includes(ev.event_type) && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{ev.actor_name || ev.actor_role || 'System'}</span>
                      {' '}{ev.note}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
