import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { cors, authenticateRequest, handleAuthError } from './lib/auth.js'
import { checkRateLimit } from './lib/rateLimit.js'
import {
  invitationEmail,
  welcomeEmail,
  roleChangedEmail,
  timesheetReminderEmail,
  timesheetSubmittedEmail,
  projectEndingSoonEmail,
  budgetAlertEmail,
  trialExpiringEmail,
  periodLockedEmail,
  signupConfirmationEmail,
  socialWelcomeEmail,
  emailChangedEmail,
  passwordChangedEmail,
  absenceRequestedEmail,
  absenceApprovedEmail,
  absenceRejectedEmail,
  timesheetApprovedEmail,
  timesheetRejectedEmail,
  absenceCancelledEmail,
  projectCreatedEmail,
  staffDeactivatedEmail,
  allocationChangedEmail,
  proposalStatusChangedEmail,
  memberRemovedEmail,
  substituteNotificationEmail,
  collabPartnerInvitationEmail,
  collabReportReminderEmail,
  collabReportStatusEmail,
  collabDeliverableReminderEmail,
  collabMilestoneReminderEmail,
  timesheetReadyToSignEmail,
  timesheetSignedEmail,
  supportRequestEmail,
} from './emails/templates.js'
import type { EmailTemplate } from './emails/templates.js'

const TEMPLATE_MAP: Record<string, (params: any) => EmailTemplate> = {
  invitation: invitationEmail,
  welcome: welcomeEmail,
  roleChanged: roleChangedEmail,
  timesheetReminder: timesheetReminderEmail,
  timesheetSubmitted: timesheetSubmittedEmail,
  projectEndingSoon: projectEndingSoonEmail,
  budgetAlert: budgetAlertEmail,
  trialExpiring: trialExpiringEmail,
  periodLocked: periodLockedEmail,
  signupConfirmation: signupConfirmationEmail,
  socialWelcome: socialWelcomeEmail,
  emailChanged: emailChangedEmail,
  passwordChanged: passwordChangedEmail,
  absenceRequested: absenceRequestedEmail,
  absenceApproved: absenceApprovedEmail,
  absenceRejected: absenceRejectedEmail,
  timesheetApproved: timesheetApprovedEmail,
  timesheetRejected: timesheetRejectedEmail,
  absenceCancelled: absenceCancelledEmail,
  projectCreated: projectCreatedEmail,
  staffDeactivated: staffDeactivatedEmail,
  allocationChanged: allocationChangedEmail,
  proposalStatusChanged: proposalStatusChangedEmail,
  memberRemoved: memberRemovedEmail,
  substituteNotification: substituteNotificationEmail,
  collabPartnerInvitation: collabPartnerInvitationEmail,
  collabReportReminder: collabReportReminderEmail,
  collabReportStatus: collabReportStatusEmail,
  collabDeliverableReminder: collabDeliverableReminderEmail,
  collabMilestoneReminder: collabMilestoneReminderEmail,
  timesheetReadyToSign: timesheetReadyToSignEmail,
  timesheetSigned: timesheetSignedEmail,
  supportRequest: supportRequestEmail,
}

/** Maps template name → user_preferences column that controls it */
const PREF_COLUMN_MAP: Record<string, string> = {
  timesheetReminder: 'email_timesheet_reminders',
  timesheetSubmitted: 'email_timesheet_submitted',
  projectEndingSoon: 'email_project_alerts',
  budgetAlert: 'email_budget_alerts',
  periodLocked: 'email_period_locked',
  roleChanged: 'email_role_changes',
  invitation: 'email_invitations',
  welcome: 'email_welcome',
  trialExpiring: 'email_trial_expiring',
  // absenceCancelled — always sent (approver needs to know)
  // staffDeactivated — always sent (courtesy notice)
  // memberRemoved — always sent (access revocation notice)
  timesheetApproved: 'email_timesheet_submitted',
  timesheetRejected: 'email_timesheet_submitted',
  allocationChanged: 'email_project_alerts',
  projectCreated: 'email_project_alerts',
  proposalStatusChanged: 'email_project_alerts',
  substituteNotification: 'email_substitute_notifications',
  absenceRequested: 'email_absence_notifications',
  absenceApproved: 'email_absence_notifications',
  absenceRejected: 'email_absence_notifications',
  collabPartnerInvitation: 'email_collab_notifications',
  collabReportReminder: 'email_collab_notifications',
  collabReportStatus: 'email_collab_notifications',
  collabDeliverableReminder: 'email_collab_notifications',
  collabMilestoneReminder: 'email_collab_notifications',
}

const FROM_ADDRESS = 'GrantLume <notifications@grantlume.com>'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grantlume.com'

/**
 * Check if a recipient has opted out of a given template.
 * Also returns the user's unsubscribe_token for personalized email links.
 */
async function checkRecipient(
  recipientEmail: string,
  templateName: string,
): Promise<{ allowed: boolean; unsubscribeToken: string | null }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return { allowed: true, unsubscribeToken: null }

  try {
    const sb = createClient(supabaseUrl, serviceKey)

    const { data: listData } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const authUser = listData?.users?.find((u: any) => u.email === recipientEmail)
    if (!authUser) return { allowed: true, unsubscribeToken: null }

    // Query their preferences across all orgs (select preference column + token)
    const prefCol = PREF_COLUMN_MAP[templateName]
    const selectCols = prefCol ? `${prefCol}, unsubscribe_token` : 'unsubscribe_token'

    const { data: prefs } = await sb
      .from('user_preferences')
      .select(selectCols)
      .eq('user_id', authUser.id)

    if (!prefs || prefs.length === 0) return { allowed: true, unsubscribeToken: null }

    // Use the first row's token (user may have prefs in multiple orgs)
    const token = (prefs[0] as any)?.unsubscribe_token ?? null

    // Check opt-out if there's a preference column for this template
    if (prefCol) {
      const optedOut = prefs.some((p: any) => p[prefCol] === false)
      if (optedOut) return { allowed: false, unsubscribeToken: token }
    }

    return { allowed: true, unsubscribeToken: token }
  } catch {
    return { allowed: true, unsubscribeToken: null }
  }
}

/**
 * Inject personalized unsubscribe URL into email HTML.
 * Replaces the default profile link with a token-based link.
 */
function injectUnsubscribeUrl(html: string, token: string): string {
  const prefsUrl = `${APP_URL}/email-preferences?token=${token}`
  // Replace the default profile link in the footer
  return html.replace(
    /href="https:\/\/app\.grantlume\.com\/profile"/g,
    `href="${prefsUrl}"`
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limit: 20 emails per 60s per IP
  if (!checkRateLimit(req, res, { limit: 20, windowSeconds: 60, prefix: 'email' })) return

  // Authenticate — only logged-in users can trigger emails
  try {
    await authenticateRequest(req)
  } catch (err) {
    return handleAuthError(err, res)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured on server' })
  }

  const { template, to, params, replyTo } = req.body ?? {}

  if (!template || !to) {
    return res.status(400).json({ error: 'Missing required fields: template, to' })
  }

  const templateFn = TEMPLATE_MAP[template]
  if (!templateFn) {
    return res.status(400).json({ error: `Unknown template: ${template}. Available: ${Object.keys(TEMPLATE_MAP).join(', ')}` })
  }

  try {
    // Filter recipients by their email preferences and collect unsubscribe tokens
    const recipients = Array.isArray(to) ? to : [to]
    const allowedRecipients: { email: string; unsubscribeToken: string | null }[] = []

    for (const email of recipients) {
      const { allowed, unsubscribeToken } = await checkRecipient(email, template)
      if (allowed) allowedRecipients.push({ email, unsubscribeToken })
    }

    if (allowedRecipients.length === 0) {
      return res.status(200).json({ success: true, skipped: true, reason: 'All recipients opted out' })
    }

    const { subject, html: rawHtml } = templateFn(params ?? {})
    const resend = new Resend(apiKey)

    // For single recipient, inject personalized unsubscribe URL
    // For multiple recipients, use the first available token (batch emails)
    const firstToken = allowedRecipients.find(r => r.unsubscribeToken)?.unsubscribeToken
    const html = firstToken ? injectUnsubscribeUrl(rawHtml, firstToken) : rawHtml

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: allowedRecipients.map(r => r.email),
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })

    if (error) {
      console.error('[GrantLume] Resend error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, id: data?.id })
  } catch (err: any) {
    console.error('[GrantLume] Email send failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
