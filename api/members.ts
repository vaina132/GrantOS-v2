import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { cors, authenticateRequest, handleAuthError } from './lib/auth.js'
import { checkRateLimit } from './lib/rateLimit.js'

/**
 * Consolidated members API — replaces invite-member, resolve-emails, collab-invite.
 *
 * POST /api/members?action=invite-member
 * POST /api/members?action=resolve-emails
 * POST /api/members?action=collab-send
 * POST /api/members?action=collab-accept
 * POST /api/members?action=collab-lookup
 */

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return { client: createClient(supabaseUrl, serviceKey), url: supabaseUrl }
}

// Only collab-lookup is truly public — it previews the invite before the user
// signs in. collab-accept now requires the user to be authenticated so we can
// bind the partner row to the JWT's userId (not a self-declared body field).
const PUBLIC_ACTIONS = ['collab-lookup']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const action = (req.query.action as string) || ''

  // Rate limits: slower on the invite-token endpoints to blunt brute-force,
  // but not so slow that a user refreshing the invite page a few times trips
  // the limit. 20 / 60 s = 3 seconds between requests on average — fine for
  // real users, still orders of magnitude slower than a brute-force attempt.
  if (action === 'collab-lookup' || action === 'collab-accept') {
    if (!checkRateLimit(req, res, { limit: 20, windowSeconds: 60, prefix: 'members-invite' })) return
  } else {
    if (!checkRateLimit(req, res, { limit: 30, windowSeconds: 60, prefix: 'members' })) return
  }

  // Require JWT for non-public actions — and forward the authenticated user
  // context to handlers that need it.
  let authContext: Awaited<ReturnType<typeof authenticateRequest>> | null = null
  if (!PUBLIC_ACTIONS.includes(action)) {
    try {
      authContext = await authenticateRequest(req)
    } catch (err) {
      return handleAuthError(err, res)
    }
  }

  switch (action) {
    case 'invite-member':
      return handleInviteMember(req, res)
    case 'resolve-emails':
      return handleResolveEmails(req, res)
    case 'collab-send':
      return handleCollabSend(req, res)
    case 'collab-accept':
      return handleCollabAccept(req, res, authContext!)
    case 'collab-lookup':
      return handleCollabLookup(req, res)
    default:
      return res.status(400).json({ error: `Unknown action: "${action}"` })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// invite-member
// ════════════════════════════════════════════════════════════════════════════

async function handleInviteMember(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()
  if (!sb) {
    return res.status(500).json({
      error: 'Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const { email, orgId, role, invitedBy, personId } = req.body ?? {}
  if (!email || !orgId || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, orgId, role' })
  }

  try {
    let userId: string | null = null
    let isNewUser = false

    const { data: listData, error: listErr } = await sb.client.auth.admin.listUsers({ perPage: 1000 })

    if (listErr) {
      return res.status(500).json({
        error: 'Failed to list users. Check that SUPABASE_SERVICE_ROLE_KEY is correct.',
        detail: listErr.message,
      })
    }

    const existing = (listData?.users as any[])?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )

    if (existing) {
      userId = existing.id
    } else {
      const tempPassword = crypto.randomBytes(24).toString('base64url')

      const { data: created, error: createErr } = await sb.client.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      })

      if (createErr) {
        return res.status(500).json({
          error: 'Failed to create user account',
          detail: createErr.message,
        })
      }

      userId = created?.user?.id ?? null
      isNewUser = true
    }

    if (!userId) {
      return res.status(500).json({ error: 'Could not resolve user ID' })
    }

    // Check if already a member
    const { data: existingMember } = await sb.client
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this organisation' })
    }

    // Insert org_members row
    const { error: insertErr } = await sb.client.from('org_members').insert({
      user_id: userId,
      org_id: orgId,
      role,
      invited_by: invitedBy ?? null,
    })

    if (insertErr) {
      return res.status(500).json({
        error: 'Failed to add member to organisation',
        detail: insertErr.message,
      })
    }

    // Link person record if personId provided
    if (personId) {
      await sb.client.from('persons').update({
        user_id: userId,
        invite_status: 'pending',
        invite_role: role,
        updated_at: new Date().toISOString(),
      }).eq('id', personId)
    }

    return res.status(200).json({ success: true, userId, isNewUser })
  } catch (err: any) {
    console.error('[GrantLume] invite-member failed:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// resolve-emails
// ════════════════════════════════════════════════════════════════════════════

async function handleResolveEmails(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()
  if (!sb) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' })
  }

  const { userIds } = req.body ?? {}
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Missing required field: userIds (array)' })
  }

  try {
    const { data: listData } = await sb.client.auth.admin.listUsers({ perPage: 1000 })
    const users = listData?.users ?? []

    const emails: Record<string, string> = {}
    for (const uid of userIds) {
      const u = users.find((x: any) => x.id === uid)
      if (u?.email) emails[uid] = u.email
    }

    return res.status(200).json({ emails })
  } catch (err: any) {
    console.error('[GrantLume] resolve-emails failed:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// collab-accept
// ════════════════════════════════════════════════════════════════════════════
//
// Security model:
//  - Caller MUST be authenticated (JWT required upstream).
//  - The partner row is bound to `auth.userId` from the JWT. Any `userId`
//    in the body is ignored — otherwise anyone holding the invite URL could
//    bind it to someone else's account.
//  - On success the `invite_token` is rotated to a fresh UUID, which makes
//    the original invite URL single-use even if it's forwarded/leaked.

async function handleCollabAccept(
  req: VercelRequest,
  res: VercelResponse,
  auth: Awaited<ReturnType<typeof authenticateRequest>>,
) {
  const sb = getSupabase()
  if (!sb) return res.status(500).json({ error: 'Server configuration error' })

  const { token } = req.body ?? {}
  if (!token) return res.status(400).json({ error: 'Missing token' })
  if (!auth?.userId) return res.status(401).json({ error: 'Not authenticated' })

  const { data: partner, error: findErr } = await sb.client
    .from('project_partners')
    .select('id, project_id, org_name, invite_status, user_id')
    .eq('invite_token', token)
    .maybeSingle()

  if (findErr || !partner) {
    return res.status(404).json({ error: 'Invitation not found or already used' })
  }

  if (partner.invite_status === 'declined') {
    return res.status(400).json({ error: 'This invitation was declined' })
  }

  // If already accepted, only allow the already-bound user to see it. This
  // prevents an attacker who learns the token after the fact from hijacking.
  if (partner.invite_status === 'accepted') {
    if (partner.user_id && partner.user_id !== auth.userId) {
      return res.status(403).json({ error: 'Invitation already bound to a different account' })
    }
    return res.status(200).json({
      success: true,
      message: 'Already accepted',
      projectId: partner.project_id,
    })
  }

  const updateData = {
    invite_status: 'accepted',
    user_id: auth.userId,
    // Rotate the token so the invite URL becomes single-use.
    invite_token: crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  }

  const { error: updateErr } = await sb.client
    .from('project_partners')
    .update(updateData)
    .eq('id', partner.id)
    .eq('invite_status', 'pending')  // defensive — only transition pending→accepted

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

// ════════════════════════════════════════════════════════════════════════════
// collab-send
// ════════════════════════════════════════════════════════════════════════════

async function handleCollabSend(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()
  if (!sb) return res.status(500).json({ error: 'Server configuration error' })

  const { projectId, senderName } = req.body
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' })

  const { data: project, error: projErr } = await sb.client
    .from('projects')
    .select('acronym, title')
    .eq('id', projectId)
    .single()

  if (projErr || !project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const { data: partners, error: partErr } = await sb.client
    .from('project_partners')
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
    sent.push(p.org_name)
  }

  return res.status(200).json({
    success: true,
    sent,
    skipped,
    totalPending: (partners ?? []).length,
    inviteBaseUrl: `${baseUrl}/collab/accept`,
  })
}

// ════════════════════════════════════════════════════════════════════════════
// collab-lookup
// ════════════════════════════════════════════════════════════════════════════

async function handleCollabLookup(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()
  if (!sb) return res.status(500).json({ error: 'Server configuration error' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const { data: partner, error } = await sb.client
    .from('project_partners')
    .select(`
      id, org_name, invite_status, role, participant_number,
      project:projects(id, acronym, title, org_id, organisations(name))
    `)
    .eq('invite_token', token)
    .single()

  if (error || !partner) {
    return res.status(404).json({ error: 'Invitation not found' })
  }

  // Normalise key name for legacy UI that reads `collab_projects`.
  const shaped = { ...partner, collab_projects: (partner as any).project }
  return res.status(200).json({ success: true, partner: shaped })
}
