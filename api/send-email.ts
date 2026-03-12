import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import {
  invitationEmail,
  welcomeEmail,
  roleChangedEmail,
  timesheetReminderEmail,
  timesheetSubmittedEmail,
  projectEndingSoonEmail,
  budgetAlertEmail,
  guestInvitationEmail,
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
  guestInvitation: guestInvitationEmail,
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
  // guestInvitation — always sent (access grant, no opt-out)
  // absenceCancelled — always sent (approver needs to know)
  // staffDeactivated — always sent (courtesy notice)
  // memberRemoved — always sent (access revocation notice)
  timesheetApproved: 'email_timesheet_submitted',
  timesheetRejected: 'email_timesheet_submitted',
  allocationChanged: 'email_project_alerts',
  projectCreated: 'email_project_alerts',
  proposalStatusChanged: 'email_project_alerts',
}

const FROM_ADDRESS = 'GrantLume <notifications@grantlume.com>'

/**
 * Check if a recipient has opted out of a given template.
 * Returns true if the email should be sent, false if opted out.
 * Uses the service role key to bypass RLS and read user_preferences.
 */
async function shouldSend(
  recipientEmail: string,
  templateName: string,
): Promise<boolean> {
  const prefCol = PREF_COLUMN_MAP[templateName]
  if (!prefCol) return true // No preference column = always send

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return true // Can't check, default to send

  try {
    const sb = createClient(supabaseUrl, serviceKey)

    // Find user ID by email via org_members join (email lives on persons table linked by org_members)
    // Simpler: query org_members → auth.users via the admin API
    const { data: listData } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const authUser = listData?.users?.find((u: any) => u.email === recipientEmail)
    if (!authUser) return true // Unknown user, send anyway

    // Query their preferences across all orgs
    const { data: prefs } = await sb
      .from('user_preferences')
      .select(prefCol)
      .eq('user_id', authUser.id)

    if (!prefs || prefs.length === 0) return true // No prefs set, default to send

    // If any org preference has this template disabled, don't send
    return prefs.every((p: any) => p[prefCol] !== false)
  } catch {
    // If anything fails, default to sending
    return true
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured on server' })
  }

  const { template, to, params } = req.body ?? {}

  if (!template || !to) {
    return res.status(400).json({ error: 'Missing required fields: template, to' })
  }

  const templateFn = TEMPLATE_MAP[template]
  if (!templateFn) {
    return res.status(400).json({ error: `Unknown template: ${template}. Available: ${Object.keys(TEMPLATE_MAP).join(', ')}` })
  }

  try {
    // Filter recipients by their email preferences
    const recipients = Array.isArray(to) ? to : [to]
    const allowedRecipients: string[] = []

    for (const email of recipients) {
      const allowed = await shouldSend(email, template)
      if (allowed) allowedRecipients.push(email)
    }

    if (allowedRecipients.length === 0) {
      return res.status(200).json({ success: true, skipped: true, reason: 'All recipients opted out' })
    }

    const { subject, html } = templateFn(params ?? {})
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: allowedRecipients,
      subject,
      html,
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
