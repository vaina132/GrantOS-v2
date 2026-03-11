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
  | 'guestInvitation'
  | 'trialExpiring'
  | 'periodLocked'

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

  /** Send guest invitation */
  async sendGuestInvitation(params: {
    guestEmail: string
    orgName: string
    projectAcronym: string
    invitedByName: string
    accessLevel: string
    loginUrl: string
  }) {
    return sendEmail({ template: 'guestInvitation', to: params.guestEmail, params })
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
}
