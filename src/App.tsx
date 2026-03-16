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
import { ProposalsPage } from '@/features/proposals/ProposalsPage'
import { ProfileSettingsPage } from '@/features/profile/ProfileSettingsPage'
import { TermsPage } from '@/features/legal/TermsPage'
import { PrivacyPage } from '@/features/legal/PrivacyPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { HelpPage } from '@/features/help/HelpPage'
import { CollabAcceptInvite } from '@/features/projects/collaboration/CollabAcceptInvite'
import { InviteSignupPage } from '@/features/auth/InviteSignupPage'
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
  const { initialize, isLoading, user, orgId, accessType, signOut } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Ephemeral session: sign out when browser/tab closes if "Stay logged in" was unchecked
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('gl_session_ephemeral') === '1') {
        // Use synchronous localStorage flag so next load knows to sign out
        localStorage.setItem('gl_signout_pending', '1')
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // On mount, check if a signout was pending (from a previous ephemeral session)
  useEffect(() => {
    if (localStorage.getItem('gl_signout_pending') === '1') {
      localStorage.removeItem('gl_signout_pending')
      signOut()
    }
  }, [signOut])

  if (isLoading) {
    return <LoadingScreen />
  }

  // User is authenticated but has no organisation — show onboarding
  // Collab-only users (accessType === 'collab_partner') skip onboarding
  const isCollabOnly = accessType === 'collab_partner'
  const needsOnboarding = user && !orgId && !isCollabOnly
  const userHome = isCollabOnly ? '/projects/collaboration' : '/dashboard'

  // Detect whether we're on the app subdomain (app.grantlume.com) or the marketing domain
  const hostname = window.location.hostname
  const isAppDomain = hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'

  return (
    <>
      <Routes>
        <Route path="/" element={
          user
            ? <Navigate to={userHome} replace />
            : isAppDomain
              ? <Navigate to="/login" replace />
              : <LandingPage />
        } />
        <Route path="/home" element={user ? <Navigate to={userHome} replace /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to={userHome} replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to={userHome} replace /> : <SignUpPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/collab/accept" element={<CollabAcceptInvite />} />
        <Route path="/invite/accept" element={user ? <Navigate to={userHome} replace /> : <InviteSignupPage />} />

        <Route
          path="/*"
          element={
            !user && !isAppDomain ? (
              <LandingPage />
            ) : <ProtectedRoute>
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
                      <Route path="/help" element={<HelpPage />} />
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
