/**
 * Email service — sends emails via Vercel API route → Resend
 */

const EMAIL_API_URL = '/api/send-email'

type EmailTemplate =
  | 'invitation'
  | 'welcome'
  | 'roleChanged'
  | 'timesheetReminder'
  | 'timesheetSubmitted'
  | 'projectEndingSoon'
  | 'budgetAlert'
  | 'trialExpiring'
  | 'periodLocked'
  | 'signupConfirmation'
  | 'socialWelcome'
  | 'emailChanged'
  | 'passwordChanged'
  | 'absenceRequested'
  | 'absenceApproved'
  | 'absenceRejected'
  | 'timesheetApproved'
  | 'timesheetRejected'
  | 'absenceCancelled'
  | 'projectCreated'
  | 'staffDeactivated'
  | 'allocationChanged'
  | 'proposalStatusChanged'
  | 'memberRemoved'
  | 'substituteNotification'

interface SendEmailOptions {
  template: EmailTemplate
  to: string | string[]
  params: Record<string, any>
}

async function sendEmail({ template, to, params }: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, to, params }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[GrantLume] Email API error:', data.error)
      return { success: false, error: data.error }
    }

    return { success: true, id: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    console.error('[GrantLume] Email send failed:', message)
    return { success: false, error: message }
  }
}

export const emailService = {
  /** Send org invitation email */
  async sendInvitation(params: {
    invitedEmail: string
    orgName: string
    role: string
    invitedByName: string
    signUpUrl: string
  }) {
    return sendEmail({ template: 'invitation', to: params.invitedEmail, params })
  },

  /** Send welcome email after signup */
  async sendWelcome(params: {
    to: string
    userName: string
    orgName: string
    dashboardUrl: string
  }) {
    return sendEmail({ template: 'welcome', to: params.to, params })
  },

  /** Notify user that their role changed */
  async sendRoleChanged(params: {
    to: string
    userName: string
    orgName: string
    oldRole: string
    newRole: string
    dashboardUrl: string
  }) {
    return sendEmail({ template: 'roleChanged', to: params.to, params })
  },

  /** Send timesheet reminder */
  async sendTimesheetReminder(params: {
    to: string
    userName: string
    orgName: string
    period: string
    timesheetUrl: string
  }) {
    return sendEmail({ template: 'timesheetReminder', to: params.to, params })
  },

  /** Notify approver of timesheet submission */
  async sendTimesheetSubmitted(params: {
    to: string
    approverName: string
    submitterName: string
    orgName: string
    period: string
    timesheetUrl: string
  }) {
    return sendEmail({ template: 'timesheetSubmitted', to: params.to, params })
  },

  /** Notify about project ending soon */
  async sendProjectEndingSoon(params: {
    to: string | string[]
    recipientName: string
    orgName: string
    projectAcronym: string
    projectTitle: string
    endDate: string
    daysRemaining: number
    projectUrl: string
  }) {
    return sendEmail({ template: 'projectEndingSoon', to: params.to, params })
  },

  /** Send budget threshold alert */
  async sendBudgetAlert(params: {
    to: string | string[]
    recipientName: string
    orgName: string
    projectAcronym: string
    budgetCategory: string
    percentUsed: number
    projectUrl: string
  }) {
    return sendEmail({ template: 'budgetAlert', to: params.to, params })
  },


  /** Notify about trial expiring */
  async sendTrialExpiring(params: {
    to: string
    userName: string
    orgName: string
    daysRemaining: number
    upgradeUrl: string
  }) {
    return sendEmail({ template: 'trialExpiring', to: params.to, params })
  },

  /** Notify about period being locked */
  async sendPeriodLocked(params: {
    to: string | string[]
    recipientName: string
    orgName: string
    period: string
    lockedBy: string
  }) {
    return sendEmail({ template: 'periodLocked', to: params.to, params })
  },

  /** Send signup confirmation email */
  async sendSignupConfirmation(params: {
    to: string
    firstName: string
    confirmUrl: string
  }) {
    return sendEmail({ template: 'signupConfirmation', to: params.to, params })
  },

  /** Send welcome email for social auth signups */
  async sendSocialWelcome(params: {
    to: string
    firstName: string
    provider: string
    dashboardUrl: string
  }) {
    return sendEmail({ template: 'socialWelcome', to: params.to, params })
  },

  /** Notify user their email was changed */
  async sendEmailChanged(params: {
    to: string
    firstName: string
    newEmail: string
  }) {
    return sendEmail({ template: 'emailChanged', to: params.to, params })
  },

  /** Notify user their password was changed */
  async sendPasswordChanged(params: {
    to: string
    firstName: string
  }) {
    return sendEmail({ template: 'passwordChanged', to: params.to, params })
  },

  /** Notify approvers about a new absence request */
  async sendAbsenceRequested(params: {
    to: string
    approverName: string
    requesterName: string
    absenceType: string
    startDate: string
    endDate: string
    days: string
    absencesUrl: string
  }) {
    return sendEmail({ template: 'absenceRequested', to: params.to, params })
  },

  /** Notify employee their absence was approved */
  async sendAbsenceApproved(params: {
    to: string
    employeeName: string
    absenceType: string
    startDate: string
    endDate: string
    days: string
    absencesUrl: string
  }) {
    return sendEmail({ template: 'absenceApproved', to: params.to, params })
  },

  /** Notify employee their absence was rejected */
  async sendAbsenceRejected(params: {
    to: string
    employeeName: string
    absenceType: string
    startDate: string
    endDate: string
    days: string
    absencesUrl: string
  }) {
    return sendEmail({ template: 'absenceRejected', to: params.to, params })
  },

  /** #18 — Notify employee their timesheet was approved */
  async sendTimesheetApproved(params: {
    to: string
    employeeName: string
    period: string
    approverName: string
    timesheetUrl: string
  }) {
    return sendEmail({ template: 'timesheetApproved', to: params.to, params })
  },

  /** #19 — Notify employee their timesheet was rejected */
  async sendTimesheetRejected(params: {
    to: string
    employeeName: string
    period: string
    approverName: string
    reason?: string
    timesheetUrl: string
  }) {
    return sendEmail({ template: 'timesheetRejected', to: params.to, params })
  },

  /** #20 — Notify approvers that an employee cancelled their absence */
  async sendAbsenceCancelled(params: {
    to: string | string[]
    approverName: string
    employeeName: string
    absenceType: string
    startDate: string
    endDate: string
    days: string
    absencesUrl: string
  }) {
    return sendEmail({ template: 'absenceCancelled', to: params.to, params })
  },

  /** #21 — Notify org admins that a new project was created */
  async sendProjectCreated(params: {
    to: string | string[]
    recipientName: string
    orgName: string
    projectAcronym: string
    projectTitle: string
    createdBy: string
    projectUrl: string
  }) {
    return sendEmail({ template: 'projectCreated', to: params.to, params })
  },

  /** #22 — Notify a person that their staff record has been deactivated */
  async sendStaffDeactivated(params: {
    to: string
    employeeName: string
    orgName: string
  }) {
    return sendEmail({ template: 'staffDeactivated', to: params.to, params })
  },

  /** #23 — Notify a staff member that their PM allocation was changed */
  async sendAllocationChanged(params: {
    to: string
    employeeName: string
    orgName: string
    projectAcronym: string
    year: number
    oldPms: string
    newPms: string
    allocationsUrl: string
  }) {
    return sendEmail({ template: 'allocationChanged', to: params.to, params })
  },

  /** #25 — Notify proposal team that the status changed */
  async sendProposalStatusChanged(params: {
    to: string | string[]
    recipientName: string
    orgName: string
    proposalTitle: string
    oldStatus: string
    newStatus: string
    changedBy: string
    proposalsUrl: string
  }) {
    return sendEmail({ template: 'proposalStatusChanged', to: params.to, params })
  },

  /** #26 — Notify a user that they have been removed from an organisation */
  async sendMemberRemoved(params: {
    to: string
    userName: string
    orgName: string
  }) {
    return sendEmail({ template: 'memberRemoved', to: params.to, params })
  },

  /** #27 — Notify a substitute that they are covering for a colleague's absence */
  async sendSubstituteNotification(params: {
    to: string
    substituteName: string
    absenteeName: string
    absenceType: string
    startDate: string
    endDate: string
    days: string
    absencesUrl: string
  }) {
    return sendEmail({ template: 'substituteNotification', to: params.to, params })
  },
}
