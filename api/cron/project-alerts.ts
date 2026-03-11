import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { projectEndingSoonEmail, trialExpiringEmail } from '../emails/templates.js'

/**
 * Cron job: Send project-ending-soon alerts and trial-expiring reminders.
 * Designed to run daily via Vercel Cron.
 * Add to vercel.json: { "crons": [{ "path": "/api/cron/project-alerts", "schedule": "0 8 * * *" }] }
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
        // Get admins and project managers for this org
        const { data: managers } = await supabase
          .from('org_members')
          .select('user_id, role')
          .eq('org_id', project.org_id)
          .in('role', ['Admin', 'Project Manager'])

        if (!managers || managers.length === 0) continue

        // Get org name
        const { data: org } = await supabase
          .from('organisations')
          .select('name')
          .eq('id', project.org_id)
          .single()

        // Get user emails via auth admin (service role)
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
            await resend.emails.send({
              from: 'GrantLume <notifications@grantlume.com>',
              to: email,
              subject,
              html,
            })
            totalSent++
          } catch (emailErr) {
            console.error(`[GrantLume] Failed to send project alert to ${email}:`, emailErr)
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

        // Get admin users
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
            await resend.emails.send({
              from: 'GrantLume <notifications@grantlume.com>',
              to: email,
              subject,
              html,
            })
            totalSent++
          } catch (emailErr) {
            console.error(`[GrantLume] Failed to send trial alert to ${email}:`, emailErr)
          }
        }
      }
    }

    return res.status(200).json({ message: 'Project alerts processed', sent: totalSent })
  } catch (err: any) {
    console.error('[GrantLume] Cron project-alerts error:', err)
    return res.status(500).json({ error: err.message })
  }
}
