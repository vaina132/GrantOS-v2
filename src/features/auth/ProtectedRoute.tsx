import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
          <h2 className="text-lg font-semibold">{t('auth.accessError')}</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => signOut()}>
            {t('auth.signOutAndRetry')}
          </Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (permission && !can(permission)) {
    // Collab-only users: redirect to collaboration page instead of dead-end
    const { accessType } = useAuthStore.getState()
    if (accessType === 'collab_partner') {
      return <Navigate to="/projects/collaboration" replace />
    }
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <span className="text-amber-800 text-xl font-bold">!</span>
          </div>
          <h2 className="text-lg font-semibold">{t('auth.accessRestricted')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('auth.noAccessContact')}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
