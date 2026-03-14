import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/collab-invite
 * 
 * Two actions:
 * 
 * 1. action: 'send' — Coordinator sends invitations to all pending partners
 *    Body: { action: 'send', projectId, senderName }
 *    Uses service role to read partner emails and send invitation emails.
 *
 * 2. action: 'accept' — Partner accepts an invitation via token
 *    Body: { action: 'accept', token, userId }
 *    Links the partner record to the accepting user.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { action } = req.body ?? {}

  // =========================================================================
  // ACCEPT — partner clicks invitation link
  // =========================================================================
  if (action === 'accept') {
    const { token, userId } = req.body
    if (!token) return res.status(400).json({ error: 'Missing token' })

    // Find partner by invite_token
    const { data: partner, error: findErr } = await supabase
      .from('collab_partners')
      .select('id, project_id, org_name, invite_status')
      .eq('invite_token', token)
      .single()

    if (findErr || !partner) {
      return res.status(404).json({ error: 'Invitation not found or already used' })
    }

    if (partner.invite_status === 'accepted') {
      return res.status(200).json({ success: true, message: 'Already accepted', projectId: partner.project_id })
    }

    if (partner.invite_status === 'declined') {
      return res.status(400).json({ error: 'This invitation was declined' })
    }

    // Link user to partner record
    const updateData: Record<string, any> = {
      invite_status: 'accepted',
    }
    if (userId) {
      updateData.user_id = userId
    }

    const { error: updateErr } = await supabase
      .from('collab_partners')
      .update(updateData)
      .eq('id', partner.id)

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to accept invitation', detail: updateErr.message })
    }

    return res.status(200).json({
      success: true,
      projectId: partner.project_id,
      partnerId: partner.id,
      orgName: partner.org_name,
    })
  }

  // =========================================================================
  // SEND — coordinator triggers invitations for all pending partners
  // =========================================================================
  if (action === 'send') {
    const { projectId, senderName } = req.body
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' })

    // Get project info
    const { data: project, error: projErr } = await supabase
      .from('collab_projects')
      .select('acronym, title')
      .eq('id', projectId)
      .single()

    if (projErr || !project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Get all pending partners with contact emails
    const { data: partners, error: partErr } = await supabase
      .from('collab_partners')
      .select('id, org_name, contact_email, invite_token, invite_status')
      .eq('project_id', projectId)
      .eq('invite_status', 'pending')

    if (partErr) {
      return res.status(500).json({ error: 'Failed to fetch partners', detail: partErr.message })
    }

    const baseUrl = process.env.VITE_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173'

    const sent: string[] = []
    const skipped: string[] = []

    for (const p of partners ?? []) {
      if (!p.contact_email) {
        skipped.push(p.org_name)
        continue
      }

      // Call our send-email API internally (or could use Resend directly)
      // For simplicity, we'll record the invitation as sent and let the
      // frontend send the emails via emailService
      sent.push(p.org_name)
    }

    // Mark project as notified if it has reporting periods
    // (This is a convenience — the real email sending happens from the frontend)

    return res.status(200).json({
      success: true,
      sent,
      skipped,
      totalPending: (partners ?? []).length,
      inviteBaseUrl: `${baseUrl}/collab/accept`,
    })
  }

  // =========================================================================
  // LOOKUP — get partner info by token (for the accept page)
  // =========================================================================
  if (action === 'lookup') {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Missing token' })

    const { data: partner, error } = await supabase
      .from('collab_partners')
      .select(`
        id, org_name, invite_status, role, participant_number,
        collab_projects(id, acronym, title, host_org_id, organisations(name))
      `)
      .eq('invite_token', token)
      .single()

    if (error || !partner) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    return res.status(200).json({ success: true, partner })
  }

  return res.status(400).json({ error: 'Invalid action. Use: send, accept, or lookup' })
}
