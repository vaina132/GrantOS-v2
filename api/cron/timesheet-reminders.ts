import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { timesheetReminderEmail } from '../emails/templates'

/**
 * Cron job: Send timesheet reminders to staff who haven't submitted for current month.
 * Designed to run weekly or bi-weekly via Vercel Cron.
 * Add to vercel.json: { "crons": [{ "path": "/api/cron/timesheet-reminders", "schedule": "0 9 * * 1" }] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET (Vercel cron) or POST with auth
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

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed
  const period = `${now.toLocaleString('en', { month: 'long' })} ${currentYear}`

  try {
    // Get all active orgs
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('is_active', true)

    if (!orgs || orgs.length === 0) {
      return res.status(200).json({ message: 'No active orgs', sent: 0 })
    }

    let totalSent = 0

    for (const org of orgs) {
      // Get members who should submit timesheets (have canSubmitTimesheets)
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id, role')
        .eq('org_id', org.id)

      if (!members || members.length === 0) continue

      // Get users who already have timesheet entries this month
      const { data: existingEntries } = await supabase
        .from('timesheet_entries')
        .select('person_id')
        .eq('org_id', org.id)
        .eq('year', currentYear)
        .eq('month', currentMonth)

      const submittedPersonIds = new Set((existingEntries ?? []).map((e: any) => e.person_id))

      // Get active persons linked to org
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
          timesheetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.grantos.app'}/timesheets`,
        })

        try {
          await resend.emails.send({
            from: 'GrantOS <notifications@grantos.app>',
            to: person.email,
            subject,
            html,
          })
          totalSent++
        } catch (emailErr) {
          console.error(`[GrantOS] Failed to send reminder to ${person.email}:`, emailErr)
        }
      }
    }

    return res.status(200).json({ message: 'Timesheet reminders sent', sent: totalSent })
  } catch (err: any) {
    console.error('[GrantOS] Cron timesheet-reminders error:', err)
    return res.status(500).json({ error: err.message })
  }
}
