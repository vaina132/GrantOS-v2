import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
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
} from './emails/templates'
import type { EmailTemplate } from './emails/templates'

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
}

const FROM_ADDRESS = 'GrantOS <notifications@grantos.app>'

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
    const { subject, html } = templateFn(params ?? {})
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    if (error) {
      console.error('[GrantOS] Resend error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, id: data?.id })
  } catch (err: any) {
    console.error('[GrantOS] Email send failed:', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
