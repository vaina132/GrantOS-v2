import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, FileText, Calendar, Rocket, Trash2 } from 'lucide-react'
import { collabProjectService, collabPartnerService, collabWpService, collabPeriodService } from '@/services/collabProjectService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import type { CollabProject, CollabPartner, CollabWorkPackage, CollabReportingPeriod } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function CollabProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<CollabProject | null>(null)
  const [partners, setPartners] = useState<CollabPartner[]>([])
  const [wps, setWps] = useState<CollabWorkPackage[]>([])
  const [periods, setPeriods] = useState<CollabReportingPeriod[]>([])
  const [loading, setLoading] = useState(true)

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
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load project', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleLaunch = async () => {
    if (!id || !confirm('Launch this project? Partners will be invited.')) return
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
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No partners added yet</p>
          ) : (
            <div className="space-y-3">
              {partners.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={p.role === 'coordinator' ? 'default' : 'secondary'}>
                            {p.role === 'coordinator' ? 'Coordinator' : `#${p.participant_number}`}
                          </Badge>
                          <span className="font-medium">{p.org_name}</span>
                          <Badge variant="outline" className="text-[10px]">
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Work Packages Tab */}
        <TabsContent value="wps" className="mt-4">
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
        <TabsContent value="periods" className="mt-4">
          {periods.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-2">No reporting periods configured</p>
              <p className="text-xs text-muted-foreground">
                Reporting periods will be available after project launch.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.period_type === 'formal' ? 'default' : 'secondary'}>
                            {p.period_type}
                          </Badge>
                          <span className="font-medium">{p.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Month {p.start_month} – {p.end_month}
                          {p.due_date && ` · Due: ${p.due_date}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.reports_generated && (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                            Reports Generated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
