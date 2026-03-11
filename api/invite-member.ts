import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

/**
 * POST /api/invite-member
 * Body: { email, orgId, role, invitedBy }
 *
 * Uses the Supabase service role key to:
 * 1. Find existing auth user by email, or create a new one via admin.createUser.
 * 2. Insert an org_members row so the user is part of the org.
 *
 * New users get a temporary random password — they use "Forgot Password" or
 * the invitation email link to set their real password on first login.
 *
 * Returns { success, userId, isNewUser } on success.
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
    return res.status(500).json({
      error: 'Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      debug: { hasUrl: !!supabaseUrl, hasKey: !!serviceKey },
    })
  }

  const { email, orgId, role, invitedBy } = req.body ?? {}
  if (!email || !orgId || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, orgId, role' })
  }

  const sb = createClient(supabaseUrl, serviceKey)

  try {
    // ── Step 1: Find existing user or create a new one ──
    let userId: string | null = null
    let isNewUser = false

    // Try to find existing user by listing all users and matching email
    const { data: listData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 })

    if (listErr) {
      return res.status(500).json({
        error: 'Failed to list users. Check that SUPABASE_SERVICE_ROLE_KEY is correct.',
        detail: listErr.message,
      })
    }

    const existing = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )

    if (existing) {
      userId = existing.id
    } else {
      // Create a new auth user with a random temporary password.
      // The invited user will use the "Forgot Password" flow or the
      // password-reset link in the invitation email to set their real password.
      const tempPassword = crypto.randomBytes(24).toString('base64url')

      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm so they can use password reset
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
      return res.status(500).json({
        error: 'Failed to add member to organisation',
        detail: insertErr.message,
      })
    }

    return res.status(200).json({ success: true, userId, isNewUser })
  } catch (err: any) {
    console.error('[GrantLume] invite-member failed:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
