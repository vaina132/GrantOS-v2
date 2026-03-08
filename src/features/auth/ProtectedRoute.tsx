import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { PermissionKey } from '@/lib/permissions'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

interface ProtectedRouteProps {
  children: ReactNode
  permission?: PermissionKey
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { user, isLoading, error, can, signOut } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-destructive text-xl font-bold">!</span>
          </div>
          <h2 className="text-lg font-semibold">Access Error</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => signOut()}>
            Sign out and try again
          </Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (permission && !can(permission)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <span className="text-amber-800 text-xl font-bold">!</span>
          </div>
          <h2 className="text-lg font-semibold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            You don't have access to this section. Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
