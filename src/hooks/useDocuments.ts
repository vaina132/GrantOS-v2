import { useQuery, useQueryClient } from '@tanstack/react-query'
import { documentService, type ProjectDocument } from '@/services/documentService'

export function useDocuments(projectId: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentService.listByProject(projectId),
    enabled: !!projectId,
  })

  return { documents: data ?? [] as ProjectDocument[], isLoading, refetch }
}

export function useInvalidateDocuments() {
  const queryClient = useQueryClient()
  return (projectId?: string) => {
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    }
  }
}
