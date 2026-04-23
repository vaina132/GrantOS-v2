import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Users,
  FileText,
  LayoutGrid,
  ClipboardList,
  ArrowRightCircle,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { proposalService } from '@/services/proposalService'
import { proposalAuditService } from '@/services/proposalWorkflowService'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import type { Proposal, ProposalAuditEvent } from '@/types'
import { ProposalPartnersTab } from './ProposalPartnersTab'
import { ProposalWorkPackagesTab } from './ProposalWorkPackagesTab'
import { ProposalDocumentsTab } from './ProposalDocumentsTab'
import { ProposalConvertDialog } from './ProposalConvertDialog'

/**
 * Proposal detail — consortium workspace.
 *
 * This replaces the old phase-tracker layout. Each tab is a thin placeholder
 * for now; the sub-components (Partners / Documents matrix / WP skeleton /
 * Activity log) land in the follow-up commits for each area. The goal of
 * this commit is to get a stable, typed skeleton shipping so the phase
 * tracker can be deleted without breaking the build.
 */
export function ProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { orgId, can } = useAuthStore()
  const canManage = can('canManageProjects') || can('canManageOrg')

  const [loading, setLoading] = useState(true)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [auditEvents, setAuditEvents] = useState<ProposalAuditEvent[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  const reload = async () => {
    if (!id) return
    try {
      const p = await proposalService.getById(id)
      setProposal(p)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load proposal',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    if (!id || !orgId) return
    setLoading(true)
    reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId])

  useEffect(() => {
    if (!id || activeTab !== 'activity') return
    proposalAuditService.list(id).then(setAuditEvents).catch(() => setAuditEvents([]))
  }, [id, activeTab])

  const convertedLabel = useMemo(() => {
    if (!proposal?.converted_project_id) return null
    return 'Converted to project'
  }, [proposal])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('common.notFound')}</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/proposals')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to proposals
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={proposal.project_name}
        description={proposal.call_identifier || proposal.funding_scheme || 'Grant proposal workspace'}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/proposals')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {proposal.status === 'Granted' && !proposal.converted_project_id && canManage && (
              <Button size="sm" className="gap-1.5" onClick={() => setConvertOpen(true)}>
                <ArrowRightCircle className="h-4 w-4" /> Convert to Project
              </Button>
            )}
            {proposal.converted_project_id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/projects/${proposal.converted_project_id}`)}
              >
                Go to Project
              </Button>
            )}
          </div>
        }
      />

      {convertedLabel && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-emerald-800 dark:text-emerald-300">
              This proposal has been converted into a project. Its data is now read-only.
            </span>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview"><FileText className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="partners"><Users className="h-4 w-4 mr-1" /> Partners</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
          <TabsTrigger value="wps"><LayoutGrid className="h-4 w-4 mr-1" /> Work packages</TabsTrigger>
          <TabsTrigger value="activity"><ClipboardList className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="pt-4 grid gap-4 sm:grid-cols-4">
              <KpiStat label="Status" value={<Badge variant="outline">{proposal.status}</Badge>} />
              <KpiStat
                label="Submission deadline"
                value={proposal.submission_deadline
                  ? new Date(proposal.submission_deadline).toLocaleDateString()
                  : '—'}
              />
              <KpiStat
                label="Responsible"
                value={proposal.responsible_person?.full_name ?? '—'}
              />
              <KpiStat
                label="Our person-months"
                value={proposal.our_pms > 0 ? String(proposal.our_pms) : '—'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partners" className="mt-4">
          <ProposalPartnersTab proposal={proposal} canManage={canManage && !proposal.converted_project_id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <ProposalDocumentsTab proposal={proposal} canManage={canManage && !proposal.converted_project_id} />
        </TabsContent>

        <TabsContent value="wps" className="mt-4">
          <ProposalWorkPackagesTab proposal={proposal} canManage={canManage && !proposal.converted_project_id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityLog events={auditEvents} />
        </TabsContent>
      </Tabs>

      <ProposalConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        proposal={proposal}
        onConverted={(newProjectId) => {
          setConvertOpen(false)
          void reload()
          navigate(`/projects/${newProjectId}`)
        }}
      />
    </div>
  )
}

function KpiStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  )
}

function ActivityLog({ events }: { events: ProposalAuditEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No activity yet. Invites, submissions and reviews will appear here.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-3 text-sm border-b last:border-0 py-2">
            <div className="text-xs text-muted-foreground w-36 shrink-0">
              {new Date(e.created_at).toLocaleString()}
            </div>
            <div className="flex-1">
              <span className="font-medium capitalize">{e.event_type.replace(/_/g, ' ')}</span>
              {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
