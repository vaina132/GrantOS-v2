import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collabProjectService } from '@/services/collabProjectService'
import { useAuthStore } from '@/stores/authStore'
import type { CollabProject } from '@/types'

export function useCollabProjects() {
  const { orgId, accessType, user } = useAuthStore()
  const isCollabOnly = accessType === 'collab_partner'

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['collabProjects', orgId, user?.id, isCollabOnly],
    queryFn: async () => {
      if (isCollabOnly && user) {
        return collabProjectService.listForPartner(user.id)
      }
      if (orgId) {
        return collabProjectService.list(orgId)
      }
      return []
    },
    enabled: !!(orgId || (isCollabOnly && user)),
  })

  return { collabProjects: data ?? [] as CollabProject[], isLoading, refetch }
}

/** Invalidate all collab-project queries */
export function useInvalidateCollabProjects() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['collabProjects'] })
  }
}
