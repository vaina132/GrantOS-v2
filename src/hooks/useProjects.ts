import { useQuery, useQueryClient } from '@tanstack/react-query'
import { projectsService, type ProjectFilters } from '@/services/projectsService'
import { useAuthStore } from '@/stores/authStore'
import type { Project, WorkPackage } from '@/types'

export function useProjects(filters?: ProjectFilters) {
  const { orgId } = useAuthStore()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects', orgId, filters?.search, filters?.status, filters?.funding_scheme_id],
    queryFn: () => projectsService.list(orgId, filters),
    enabled: !!orgId,
  })

  return { projects: data ?? [] as Project[], isLoading, isError, error, refetch }
}

export function useProject(id: string | undefined) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsService.getById(id!),
    enabled: !!id,
  })

  return { project: data ?? null as Project | null, isLoading, isError, error, refetch }
}

export function useWorkPackages(projectId: string | undefined) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workPackages', projectId],
    queryFn: () => projectsService.listWorkPackages(projectId!),
    enabled: !!projectId,
  })

  return { workPackages: data ?? [] as WorkPackage[], isLoading, isError, error, refetch }
}

/** Invalidate all project-related queries (call after mutations) */
export function useInvalidateProjects() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['project'] })
    queryClient.invalidateQueries({ queryKey: ['workPackages'] })
  }
}
