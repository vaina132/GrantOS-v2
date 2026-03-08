import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'
import type { PermissionKey } from '@/lib/permissions'

interface PermissionGateProps {
  permission: PermissionKey
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can } = useAuthStore()

  if (!can(permission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
