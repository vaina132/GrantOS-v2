import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/toaster'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { StaffPage } from '@/features/staff/StaffPage'
import { AllocationsPage } from '@/features/allocations/AllocationsPage'
import { MatrixPage } from '@/features/matrix/MatrixPage'
import { TimesheetsPage } from '@/features/timesheets/TimesheetsPage'
import { AbsencesPage } from '@/features/absences/AbsencesPage'
import { FinancialsPage } from '@/features/financials/FinancialsPage'
import { TimelinePage } from '@/features/timeline/TimelinePage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { ImportPage } from '@/features/import/ImportPage'
import { AuditPage } from '@/features/audit/AuditPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { GuestAccessPage } from '@/features/guests/GuestAccessPage'
import { Skeleton } from '@/components/ui/skeleton'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="space-y-4 w-64 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
          G
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
      </div>
    </div>
  )
}

export default function App() {
  const { initialize, isLoading, user } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/projects/*" element={<ProjectsPage />} />
                  <Route path="/staff/*" element={<StaffPage />} />
                  <Route
                    path="/allocations"
                    element={
                      <ProtectedRoute permission="canManageAllocations">
                        <AllocationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/matrix"
                    element={
                      <ProtectedRoute permission="canManageAllocations">
                        <MatrixPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/timesheets" element={<TimesheetsPage />} />
                  <Route
                    path="/absences"
                    element={
                      <ProtectedRoute permission="canManageAllocations">
                        <AbsencesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/financials"
                    element={
                      <ProtectedRoute permission="canSeeFinancials">
                        <FinancialsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/timeline" element={<TimelinePage />} />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute permission="canGenerateReports">
                        <ReportsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/import"
                    element={
                      <ProtectedRoute permission="canManageOrg">
                        <ImportPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/audit"
                    element={
                      <ProtectedRoute permission="canSeeFinancials">
                        <AuditPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/guests"
                    element={
                      <ProtectedRoute permission="canManageOrg">
                        <GuestAccessPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute permission="canManageOrg">
                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </>
  )
}
