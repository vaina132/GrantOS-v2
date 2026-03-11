import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/toaster'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'
import { OnboardingWizard } from '@/features/auth/OnboardingWizard'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { StaffPage } from '@/features/staff/StaffPage'
import { AllocationsPage } from '@/features/allocations/AllocationsPage'
import { TimesheetsPage } from '@/features/timesheets/TimesheetsPage'
import { AbsencesPage } from '@/features/absences/AbsencesPage'
import { FinancialsPage } from '@/features/financials/FinancialsPage'
import { TimelinePage } from '@/features/timeline/TimelinePage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { ImportPage } from '@/features/import/ImportPage'
import { AuditPage } from '@/features/audit/AuditPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { GuestAccessPage } from '@/features/guests/GuestAccessPage'
import { ProposalsPage } from '@/features/proposals/ProposalsPage'
import { ProfileSettingsPage } from '@/features/profile/ProfileSettingsPage'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
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
  const { initialize, isLoading, user, orgId } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return <LoadingScreen />
  }

  // User is authenticated but has no organisation — show onboarding
  const needsOnboarding = user && !orgId

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignUpPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              {needsOnboarding ? (
                <OnboardingWizard />
              ) : (
                <AppShell>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/projects/*" element={<ProjectsPage />} />
                      <Route path="/staff/*" element={<StaffPage />} />
                      <Route
                        path="/allocations"
                        element={
                          <ProtectedRoute permission="canSeeAllocations">
                            <AllocationsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/timesheets"
                        element={
                          <ProtectedRoute permission="canSeeTimesheets">
                            <TimesheetsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/absences"
                        element={
                          <ProtectedRoute permission="canSeeAbsences">
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
                      <Route
                        path="/timeline"
                        element={
                          <ProtectedRoute permission="canSeeTimeline">
                            <TimelinePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <ProtectedRoute permission="canSeeReports">
                            <ReportsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/import"
                        element={
                          <ProtectedRoute permission="canSeeImport">
                            <ImportPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/audit"
                        element={
                          <ProtectedRoute permission="canSeeAudit">
                            <AuditPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/guests"
                        element={
                          <ProtectedRoute permission="canSeeGuests">
                            <GuestAccessPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/proposals"
                        element={
                          <ProtectedRoute permission="canSeeProposals">
                            <ProposalsPage />
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
                      <Route path="/profile" element={<ProfileSettingsPage />} />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </ErrorBoundary>
                </AppShell>
              )}
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </>
  )
}
