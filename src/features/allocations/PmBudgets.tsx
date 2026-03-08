import { useState, useEffect } from 'react'
import { allocationsService } from '@/services/allocationsService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useProjects } from '@/hooks/useProjects'
import { usePmBudgets } from '@/hooks/useAllocations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { toast } from '@/components/ui/use-toast'
import { Save, Target } from 'lucide-react'
import type { AssignmentType } from '@/types'

interface PmBudgetsProps {
  type: AssignmentType
}

export function PmBudgets({ type }: PmBudgetsProps) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const { projects, isLoading: loadingProjects } = useProjects()
  const { budgets, isLoading: loadingBudgets, refetch } = usePmBudgets(type)
  const [localBudgets, setLocalBudgets] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map: Record<string, number> = {}
    for (const b of budgets) {
      map[b.project_id] = b.target_pms
    }
    setLocalBudgets(map)
    setDirty(false)
  }, [budgets])

  const handleChange = (projectId: string, value: number) => {
    setLocalBudgets((prev) => ({ ...prev, [projectId]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      for (const [projectId, target_pms] of Object.entries(localBudgets)) {
        await allocationsService.upsertPmBudget({
          org_id: orgId,
          project_id: projectId,
          work_package_id: null,
          year: globalYear,
          target_pms,
          type,
        })
      }
      toast({ title: 'Saved', description: 'PM budgets have been saved.' })
      setDirty(false)
      refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loadingProjects || loadingBudgets) {
    return <Skeleton className="h-48 w-full" />
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No projects"
        description="Create projects first to set PM budgets."
      />
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">PM Budgets — {type === 'actual' ? 'Actual' : 'Official'} ({globalYear})</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Project</th>
                <th className="px-4 py-2 text-right font-medium w-32">Target PMs</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-semibold text-primary">{project.acronym}</span>
                    <span className="ml-2 text-muted-foreground text-xs">{project.title}</span>
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={localBudgets[project.id] ?? ''}
                      onChange={(e) => handleChange(project.id, Number(e.target.value) || 0)}
                      className="w-24 ml-auto text-right tabular-nums h-8"
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
