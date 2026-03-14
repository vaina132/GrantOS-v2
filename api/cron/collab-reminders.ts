import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  collabReportReminderEmail,
  collabDeliverableReminderEmail,
} from '../emails/templates.js'

/**
 * Cron job: Send collaboration project reminders.
 * - Report due reminders (7 days before due_date)
 * - Deliverable due reminders (30 and 14 days before due month)
 * Runs daily at 9 AM UTC.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const resendKey = process.env.RESEND_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!resendKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const resend = new Resend(resendKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grantlume.com'
  const from = 'GrantLume <notifications@grantlume.com>'

  let totalSent = 0

  try {
    // ── 1. Report due reminders ──
    // Find active collab projects with reporting periods that have a due_date 7 days from now
    // and have reports_generated = true with reports still in draft status
    const now = new Date()
    const reminderDate = new Date(now)
    reminderDate.setDate(reminderDate.getDate() + 7)
    const reminderDateStr = reminderDate.toISOString().split('T')[0]

    const { data: duePeriods } = await supabase
      .from('collab_reporting_periods')
      .select('id, project_id, title, start_month, end_month, due_date, reports_generated')
      .eq('due_date', reminderDateStr)
      .eq('reports_generated', true)

    if (duePeriods && duePeriods.length > 0) {
      for (const period of duePeriods) {
        // Get project info
        const { data: project } = await supabase
          .from('collab_projects')
          .select('id, acronym, title, status')
          .eq('id', period.project_id)
          .eq('status', 'active')
          .single()

        if (!project) continue

        // Get draft reports for this period
        const { data: draftReports } = await supabase
          .from('collab_reports')
          .select('id, partner_id, status')
          .eq('period_id', period.id)
          .in('status', ['draft', 'rejected'])

        if (!draftReports || draftReports.length === 0) continue

        for (const report of draftReports) {
          // Get partner contact info
          const { data: partner } = await supabase
            .from('collab_partners')
            .select('id, org_name, contact_name, contact_email')
            .eq('id', report.partner_id)
            .single()

          if (!partner?.contact_email) continue

          try {
            const template = collabReportReminderEmail({
              contactName: partner.contact_name || '',
              orgName: partner.org_name,
              projectAcronym: project.acronym,
              periodTitle: period.title,
              dueDate: period.due_date,
              reportUrl: `${appUrl}/projects/collaboration/report/${report.id}`,
            })

            await resend.emails.send({
              from,
              to: partner.contact_email,
              subject: template.subject,
              html: template.html,
            })
            totalSent++
          } catch (err) {
            console.error(`[collab-reminders] Failed to send report reminder to ${partner.contact_email}:`, err)
          }
        }
      }
    }

    // ── 2. Deliverable due reminders (30 and 14 days before) ──
    // For active projects, find deliverables whose due month corresponds to ~30 or ~14 days from now
    const { data: activeProjects } = await supabase
      .from('collab_projects')
      .select('id, acronym, title, start_date, duration_months')
      .eq('status', 'active')

    if (activeProjects && activeProjects.length > 0) {
      for (const proj of activeProjects) {
        if (!proj.start_date) continue
        const projectStart = new Date(proj.start_date)

        // Get deliverables for this project
        const { data: dels } = await supabase
          .from('collab_deliverables')
          .select('id, number, title, due_month, leader_partner_id')
          .eq('project_id', proj.id)

        if (!dels || dels.length === 0) continue

        for (const del of dels) {
          if (!del.due_month || !del.leader_partner_id) continue

          // Calculate actual due date from project start + due_month
          const dueDate = new Date(projectStart)
          dueDate.setMonth(dueDate.getMonth() + del.due_month - 1)
          // Set to end of month
          dueDate.setMonth(dueDate.getMonth() + 1, 0)

          const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

          // Send reminders at 30 and 14 days before
          if (daysUntilDue !== 30 && daysUntilDue !== 14) continue

          // Get lead partner contact
          const { data: partner } = await supabase
            .from('collab_partners')
            .select('id, org_name, contact_name, contact_email')
            .eq('id', del.leader_partner_id)
            .single()

          if (!partner?.contact_email) continue

          try {
            const template = collabDeliverableReminderEmail({
              contactName: partner.contact_name || '',
              orgName: partner.org_name,
              projectAcronym: proj.acronym,
              deliverableNumber: del.number,
              deliverableTitle: del.title,
              dueMonth: del.due_month,
              dueDate: dueDate.toISOString().split('T')[0],
              projectUrl: `${appUrl}/projects/collaboration/${proj.id}`,
            })

            await resend.emails.send({
              from,
              to: partner.contact_email,
              subject: template.subject,
              html: template.html,
            })
            totalSent++
          } catch (err) {
            console.error(`[collab-reminders] Failed to send deliverable reminder to ${partner.contact_email}:`, err)
          }
        }
      }
    }

    return res.status(200).json({ success: true, sent: totalSent })
  } catch (err) {
    console.error('[collab-reminders] Cron error:', err)
    return res.status(500).json({ error: 'Cron job failed', details: String(err) })
  }
}
