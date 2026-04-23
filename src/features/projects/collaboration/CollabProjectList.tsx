import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Users, Globe, FileText, MoreHorizontal, Trash2, Rocket, Search, Archive, ArchiveRestore, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { collabProjectService } from '@/services/collabProjectService'
import { useCollabProjects } from '@/hooks/useCollabProjects'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CollabProject } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function CollabProjectList() {
  const { t } = useTranslation()
  const { accessType, aiEnabled } = useAuthStore()
  const navigate = useNavigate()
  const { collabProjects: projects, isLoading: loading, refetch } = useCollabProjects()
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  const [search, setSearch] = useState('')
  const isCollabOnly = accessType === 'collab_partner'

  const handleDelete = async (id: string) => {
    const name = projects.find(p => p.id === id)?.acronym ?? ''
    if (!confirm(t('collaboration.confirmDeleteFromList', { name }))) return
    try {
      await collabProjectService.remove(id)
      toast({ title: t('common.deleted'), description: t('collaboration.deletedProject', { name }) })
      refetch()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToDeleteProject'), variant: 'destructive' })
    }
  }

  const handleLaunch = async (id: string) => {
    if (!confirm(t('collaboration.confirmLaunchProject'))) return
    try {
      await collabProjectService.launch(id)
      toast({ title: t('collaboration.launched'), description: t('collaboration.projectNowActive') })
      refetch()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToLaunchProject'), variant: 'destructive' })
    }
  }

  const handleArchive = async (id: string, current: string) => {
    const newStatus = current === 'archived' ? 'active' : 'archived'
    const label = newStatus === 'archived' ? t('collaboration.archive') : t('collaboration.unarchive')
    if (!confirm(`${label}?`)) return
    try {
      await collabProjectService.update(id, { status: newStatus } as any)
      toast({ title: label, description: newStatus === 'archived' ? t('collaboration.projectArchived') : t('collaboration.projectRestoredActive') })
      refetch()
    } catch {
      toast({ title: t('common.error'), description: t('collaboration.failedToArchiveProject'), variant: 'destructive' })
    }
  }

  const getPartnerCount = (p: CollabProject) => {
    return p.partners?.length ?? 0
  }

  const getCoordinator = (p: CollabProject) => {
    const partners = p.partners ?? []
    return partners.find((pt: any) => pt.role === 'coordinator' || pt.is_host)?.org_name ?? '—'
  }

  const filtered = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return p.acronym.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || (p.grant_number ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    all: projects.length,
    draft: projects.filter(p => p.status === 'draft').length,
    active: projects.filter(p => p.status === 'active').length,
    archived: projects.filter(p => p.status === 'archived').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('collaboration.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('collaboration.description')}
          </p>
        </div>
        {!isCollabOnly && (
          <Button onClick={() => navigate('/projects/collaboration/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('collaboration.newProject')}
          </Button>
        )}
      </div>

      {/* AI Import quick-action */}
      {!isCollabOnly && aiEnabled && (
        <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-purple-500 shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-sm">{t('collaboration.quickImportAi')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t('collaboration.quickImportAiDesc')}
                </p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5 border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40" onClick={() => navigate('/projects/collaboration/new/ai-import')}>
                <Sparkles className="h-3.5 w-3.5" />
                {t('collaboration.importAndCreate')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs + search */}
      {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['all', 'draft', 'active', 'archived'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`collaboration.filter${s.charAt(0).toUpperCase() + s.slice(1)}`)} ({counts[s]})
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('collaboration.searchPlaceholder')}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">{t('collaboration.noProjects')}</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {t('collaboration.noProjectsDesc')}
            </p>
            <div className="flex gap-3">
              {!isCollabOnly && (
                <>
                  <Button onClick={() => navigate('/projects/collaboration/new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('collaboration.createManually')}
                  </Button>
                  {aiEnabled && (
                    <Button variant="outline" onClick={() => navigate('/projects/collaboration/new/ai-import')} className="gap-2 border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      {t('collaboration.importWithAi')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">{t('collaboration.noCollabProjectsFiltered')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/projects/collaboration/${p.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-base truncate">{p.acronym}</h3>
                      <Badge className={STATUS_COLORS[p.status] ?? ''} variant="secondary">
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-3">{p.title}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      {p.grant_number && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          GA {p.grant_number}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t('collaboration.partnerCount', { count: getPartnerCount(p) })}
                      </span>
                      <span>{t('collaboration.coordinator')}: {getCoordinator(p)}</span>
                      {p.funding_programme && <span>{p.funding_programme}</span>}
                    </div>
                  </div>

                  {!isCollabOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {p.status === 'draft' && (
                          <DropdownMenuItem onClick={() => handleLaunch(p.id)}>
                            <Rocket className="mr-2 h-4 w-4" />
                            {t('collaboration.launch')}
                          </DropdownMenuItem>
                        )}
                        {p.status === 'active' && (
                          <DropdownMenuItem onClick={() => handleArchive(p.id, p.status)}>
                            <Archive className="mr-2 h-4 w-4" />
                            {t('collaboration.archive')}
                          </DropdownMenuItem>
                        )}
                        {p.status === 'archived' && (
                          <DropdownMenuItem onClick={() => handleArchive(p.id, p.status)}>
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            {t('collaboration.unarchive')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
