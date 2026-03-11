import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/invite-member
 * Body: { email, orgId, role, invitedBy }
 *
 * Uses the Supabase service role key to:
 * 1. Find or create the auth user by email (inviteUserByEmail creates a
 *    pending user and sends a magic-link / confirmation email via Supabase).
 * 2. Insert an org_members row so the user is already part of the org
 *    when they complete sign-up.
 *
 * Returns { success, userId } on success.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' })
  }

  const { email, orgId, role, invitedBy } = req.body ?? {}
  if (!email || !orgId || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, orgId, role' })
  }

  const sb = createClient(supabaseUrl, serviceKey)

  try {
    // ── Step 1: Find existing user or create a new one ──
    let userId: string | null = null

    // Check if user already exists in auth.users
    const { data: listData } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const existing = listData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase(),
    )

    if (existing) {
      userId = existing.id
    } else {
      // Create a new user via inviteUserByEmail — Supabase sends them a
      // magic-link email so they can set their password and activate.
      const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email)

      if (inviteErr) {
        console.error('[GrantOS] inviteUserByEmail error:', inviteErr)
        return res.status(500).json({ error: inviteErr.message })
      }

      userId = invited?.user?.id ?? null
    }

    if (!userId) {
      return res.status(500).json({ error: 'Could not resolve user ID' })
    }

    // ── Step 2: Check if already a member ──
    const { data: existingMember } = await sb
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this organisation' })
    }

    // ── Step 3: Insert org_members row ──
    const { error: insertErr } = await sb.from('org_members').insert({
      user_id: userId,
      org_id: orgId,
      role,
      invited_by: invitedBy ?? null,
    })

    if (insertErr) {
      console.error('[GrantOS] org_members insert error:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ success: true, userId, isNewUser: !existing })
  } catch (err: any) {
    console.error('[GrantOS] invite-member failed:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
