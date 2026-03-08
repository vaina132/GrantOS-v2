import { useState, useEffect, useCallback } from 'react'
import { projectsService, type ProjectFilters } from '@/services/projectsService'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/use-toast'
import type { Project, WorkPackage } from '@/types'

export function useProjects(filters?: ProjectFilters) {
  const { orgId } = useAuthStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await projectsService.list(orgId, filters)
      setProjects(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, filters?.search, filters?.status, filters?.funding_scheme_id])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { projects, isLoading, refetch: fetch }
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!id) {
      setProject(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const data = await projectsService.getById(id)
      setProject(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { project, isLoading, refetch: fetch }
}

export function useWorkPackages(projectId: string | undefined) {
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!projectId) {
      setWorkPackages([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const data = await projectsService.listWorkPackages(projectId)
      setWorkPackages(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load work packages'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { workPackages, isLoading, refetch: fetch }
}
