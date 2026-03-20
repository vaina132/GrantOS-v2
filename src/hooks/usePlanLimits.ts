import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { PLAN_LIMITS } from '@/types'
import type { OrgPlan, PlanLimits } from '@/types'

export interface PlanLimitCheck {
  plan: OrgPlan
  limits: PlanLimits
  /** True if the user is on the free (expired trial) plan */
  isFree: boolean
  /** True if the user is on a paid Pro plan */
  isPro: boolean
  /** True if the user is within the 30-day trial window */
  isTrial: boolean
  /** Check if creating one more project would exceed the limit */
  canCreateProject: (currentCount: number) => boolean
  /** Check if creating one more staff member would exceed the limit */
  canCreateStaff: (currentCount: number) => boolean
  /** Check if inviting one more org member (seat) would exceed the limit */
  canInviteMember: (currentSeatCount: number) => boolean
  /** Check if a project at the given creation-order index is editable (oldest-first) */
  isProjectEditable: (creationIndex: number) => boolean
  /** Check if a staff member at the given creation-order index is editable (oldest-first) */
  isStaffEditable: (creationIndex: number) => boolean
  /** Whether AI features are available */
  hasAi: boolean
  /** Whether report export (PDF/Excel) is available */
  hasReportExport: boolean
  /** Whether the collaboration module is available */
  hasCollaboration: boolean
  /** Whether custom roles can be configured */
  hasCustomRoles: boolean
}

export function usePlanLimits(): PlanLimitCheck {
  const { orgPlan } = useAuthStore()
  const plan: OrgPlan = orgPlan ?? 'trial'
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial

  return useMemo(() => ({
    plan,
    limits,
    isFree: plan === 'free',
    isPro: plan === 'pro',
    isTrial: plan === 'trial',

    canCreateProject: (currentCount: number) =>
      limits.maxProjects === Infinity || currentCount < limits.maxProjects,

    canCreateStaff: (currentCount: number) =>
      limits.maxStaff === Infinity || currentCount < limits.maxStaff,

    canInviteMember: (currentSeatCount: number) =>
      limits.maxSeats === Infinity || currentSeatCount < limits.maxSeats,

    isProjectEditable: (creationIndex: number) =>
      limits.maxProjects === Infinity || creationIndex < limits.maxProjects,

    isStaffEditable: (creationIndex: number) =>
      limits.maxStaff === Infinity || creationIndex < limits.maxStaff,

    hasAi: limits.maxAiRequests > 0,
    hasReportExport: limits.hasReportExport,
    hasCollaboration: limits.hasCollaboration,
    hasCustomRoles: limits.hasCustomRoles,
  }), [plan, limits])
}
