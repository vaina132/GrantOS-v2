import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Globe, FileText, MoreHorizontal, Trash2, Rocket } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { collabProjectService } from '@/services/collabProjectService'
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
  const { orgId } = useAuthStore()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<CollabProject[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await collabProjectService.list(orgId)
      setProjects(data)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load collaboration projects', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [orgId])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this collaboration project? This cannot be undone.')) return
    try {
      await collabProjectService.remove(id)
      toast({ title: 'Deleted', description: 'Collaboration project removed' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' })
    }
  }

  const handleLaunch = async (id: string) => {
    if (!confirm('Launch this project? Invitations will be sent to all partners.')) return
    try {
      await collabProjectService.launch(id)
      toast({ title: 'Launched', description: 'Project is now active' })
      load()
    } catch {
      toast({ title: 'Error', description: 'Failed to launch project', variant: 'destructive' })
    }
  }

  const getPartnerCount = (p: CollabProject) => {
    return (p as any).collab_partners?.length ?? 0
  }

  const getCoordinator = (p: CollabProject) => {
    const partners = (p as any).collab_partners ?? []
    return partners.find((pt: any) => pt.role === 'coordinator')?.org_name ?? '—'
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
          <h2 className="text-xl font-semibold">Collaboration Projects</h2>
          <p className="text-sm text-muted-foreground">
            Multi-partner EU-funded projects with external reporting
          </p>
        </div>
        <Button onClick={() => navigate('/projects/collaboration/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Collaboration
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">No collaboration projects yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Create a collaboration project to manage multi-partner EU-funded research with external financial reporting.
            </p>
            <Button onClick={() => navigate('/projects/collaboration/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Collaboration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
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
                        {getPartnerCount(p)} partner{getPartnerCount(p) !== 1 ? 's' : ''}
                      </span>
                      <span>Coordinator: {getCoordinator(p)}</span>
                      {p.funding_programme && <span>{p.funding_programme}</span>}
                    </div>
                  </div>

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
                          Launch Project
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
