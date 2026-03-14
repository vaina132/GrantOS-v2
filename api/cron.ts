import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  timesheetReminderEmail,
  projectEndingSoonEmail,
  trialExpiringEmail,
  collabReportReminderEmail,
  collabDeliverableReminderEmail,
} from './emails/templates.js'

/**
 * Consolidated cron handler — dispatches by ?job= query parameter.
 * Jobs: timesheet-reminders, project-alerts, collab-reminders
 *
 * Vercel cron config calls this single function with different query params:
 *   /api/cron?job=timesheet-reminders
 *   /api/cron?job=project-alerts
 *   /api/cron?job=collab-reminders
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

  const job = (req.query.job as string) || ''

  switch (job) {
    case 'timesheet-reminders':
      return runTimesheetReminders(supabase, resend, from, appUrl, res)
    case 'project-alerts':
      return runProjectAlerts(supabase, resend, from, appUrl, res)
    case 'collab-reminders':
      return runCollabReminders(supabase, resend, from, appUrl, res)
    default:
      return res.status(400).json({ error: `Unknown job: "${job}". Use ?job=timesheet-reminders|project-alerts|collab-reminders` })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Job 1: Timesheet Reminders (weekly, Monday 9am)
// ════════════════════════════════════════════════════════════════════════════
async function runTimesheetReminders(
  supabase: ReturnType<typeof createClient>,
  resend: InstanceType<typeof Resend>,
  from: string,
  appUrl: string,
  res: VercelResponse,
) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const period = `${now.toLocaleString('en', { month: 'long' })} ${currentYear}`
  let totalSent = 0

  try {
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('is_active', true)

    if (!orgs || orgs.length === 0) {
      return res.status(200).json({ job: 'timesheet-reminders', sent: 0 })
    }

    for (const org of orgs) {
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id, role')
        .eq('org_id', org.id)

      if (!members || members.length === 0) continue

      const { data: existingEntries } = await supabase
        .from('timesheet_entries')
        .select('person_id')
        .eq('org_id', org.id)
        .eq('year', currentYear)
        .eq('month', currentMonth)

      const submittedPersonIds = new Set((existingEntries ?? []).map((e: any) => e.person_id))

      const { data: persons } = await supabase
        .from('persons')
        .select('id, full_name, email')
        .eq('org_id', org.id)
        .eq('is_active', true)

      if (!persons) continue

      for (const person of persons) {
        if (!person.email || submittedPersonIds.has(person.id)) continue

        const { subject, html } = timesheetReminderEmail({
          userName: person.full_name,
          orgName: org.name,
          period,
          timesheetUrl: `${appUrl}/timesheets`,
        })

        try {
          await resend.emails.send({ from, to: person.email, subject, html })
          totalSent++
        } catch (emailErr) {
          console.error(`[cron] Failed to send timesheet reminder to ${person.email}:`, emailErr)
        }
      }
    }

    return res.status(200).json({ job: 'timesheet-reminders', sent: totalSent })
  } catch (err: any) {
    console.error('[cron] timesheet-reminders error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Job 2: Project Alerts — ending soon + trial expiring (daily 8am)
// ════════════════════════════════════════════════════════════════════════════
async function runProjectAlerts(
  supabase: ReturnType<typeof createClient>,
  resend: InstanceType<typeof Resend>,
  from: string,
  appUrl: string,
  res: VercelResponse,
) {
  const now = new Date()
  let totalSent = 0

  try {
    // ── 1. Project ending soon alerts (30, 14, 7 days) ──
    const alertDays = [30, 14, 7]

    for (const days of alertDays) {
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + days)
      const dateStr = targetDate.toISOString().split('T')[0]

      const { data: projects } = await supabase
        .from('projects')
        .select('id, org_id, acronym, title, end_date')
        .eq('status', 'Active')
        .eq('end_date', dateStr)

      if (!projects || projects.length === 0) continue

      for (const project of projects) {
        const { data: managers } = await supabase
          .from('org_members')
          .select('user_id, role')
          .eq('org_id', project.org_id)
          .in('role', ['Admin', 'Project Manager'])

        if (!managers || managers.length === 0) continue

        const { data: org } = await supabase
          .from('organisations')
          .select('name')
          .eq('id', project.org_id)
          .single()

        for (const manager of managers) {
          const { data: userData } = await supabase.auth.admin.getUserById(manager.user_id)
          const email = userData?.user?.email
          if (!email) continue

          const { subject, html } = projectEndingSoonEmail({
            recipientName: email.split('@')[0],
            orgName: org?.name ?? 'your organisation',
            projectAcronym: project.acronym,
            projectTitle: project.title,
            endDate: project.end_date,
            daysRemaining: days,
            projectUrl: `${appUrl}/projects/${project.id}`,
          })

          try {
            await resend.emails.send({ from, to: email, subject, html })
            totalSent++
          } catch (emailErr) {
            console.error(`[cron] Failed to send project alert to ${email}:`, emailErr)
          }
        }
      }
    }

    // ── 2. Trial expiring reminders (7, 3, 1 days) ──
    const trialAlertDays = [7, 3, 1]

    for (const days of trialAlertDays) {
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + days)
      const dateStr = targetDate.toISOString().split('T')[0]

      const { data: orgs } = await supabase
        .from('organisations')
        .select('id, name, trial_ends_at')
        .eq('is_active', true)
        .not('trial_ends_at', 'is', null)

      if (!orgs) continue

      for (const org of orgs) {
        if (!org.trial_ends_at) continue
        const trialDate = org.trial_ends_at.split('T')[0]
        if (trialDate !== dateStr) continue

        const { data: admins } = await supabase
          .from('org_members')
          .select('user_id')
          .eq('org_id', org.id)
          .eq('role', 'Admin')

        if (!admins) continue

        for (const admin of admins) {
          const { data: userData } = await supabase.auth.admin.getUserById(admin.user_id)
          const email = userData?.user?.email
          if (!email) continue

          const { subject, html } = trialExpiringEmail({
            userName: email.split('@')[0],
            orgName: org.name,
            daysRemaining: days,
            upgradeUrl: `${appUrl}/settings`,
          })

          try {
            await resend.emails.send({ from, to: email, subject, html })
            totalSent++
          } catch (emailErr) {
            console.error(`[cron] Failed to send trial alert to ${email}:`, emailErr)
          }
        }
      }
    }

    return res.status(200).json({ job: 'project-alerts', sent: totalSent })
  } catch (err: any) {
    console.error('[cron] project-alerts error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Job 3: Collab Reminders — report due + deliverable due (daily 9am)
// ════════════════════════════════════════════════════════════════════════════
async function runCollabReminders(
  supabase: ReturnType<typeof createClient>,
  resend: InstanceType<typeof Resend>,
  from: string,
  appUrl: string,
  res: VercelResponse,
) {
  const now = new Date()
  let totalSent = 0

  try {
    // ── 1. Report due reminders (7 days before due_date) ──
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
        const { data: project } = await supabase
          .from('collab_projects')
          .select('id, acronym, title, status')
          .eq('id', period.project_id)
          .eq('status', 'active')
          .single()

        if (!project) continue

        const { data: draftReports } = await supabase
          .from('collab_reports')
          .select('id, partner_id, status')
          .eq('period_id', period.id)
          .in('status', ['draft', 'rejected'])

        if (!draftReports || draftReports.length === 0) continue

        for (const report of draftReports) {
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

            await resend.emails.send({ from, to: partner.contact_email, subject: template.subject, html: template.html })
            totalSent++
          } catch (err) {
            console.error(`[cron] Failed to send collab report reminder to ${partner.contact_email}:`, err)
          }
        }
      }
    }

    // ── 2. Deliverable due reminders (30 and 14 days before) ──
    const { data: activeProjects } = await supabase
      .from('collab_projects')
      .select('id, acronym, title, start_date, duration_months')
      .eq('status', 'active')

    if (activeProjects && activeProjects.length > 0) {
      for (const proj of activeProjects) {
        if (!proj.start_date) continue
        const projectStart = new Date(proj.start_date)

        const { data: dels } = await supabase
          .from('collab_deliverables')
          .select('id, number, title, due_month, leader_partner_id')
          .eq('project_id', proj.id)

        if (!dels || dels.length === 0) continue

        for (const del of dels) {
          if (!del.due_month || !del.leader_partner_id) continue

          const dueDate = new Date(projectStart)
          dueDate.setMonth(dueDate.getMonth() + del.due_month - 1)
          dueDate.setMonth(dueDate.getMonth() + 1, 0)

          const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (daysUntilDue !== 30 && daysUntilDue !== 14) continue

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

            await resend.emails.send({ from, to: partner.contact_email, subject: template.subject, html: template.html })
            totalSent++
          } catch (err) {
            console.error(`[cron] Failed to send collab deliverable reminder to ${partner.contact_email}:`, err)
          }
        }
      }
    }

    return res.status(200).json({ job: 'collab-reminders', sent: totalSent })
  } catch (err) {
    console.error('[cron] collab-reminders error:', err)
    return res.status(500).json({ error: 'Cron job failed', details: String(err) })
  }
}
