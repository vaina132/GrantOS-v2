import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/resolve-emails
 * Body: { userIds: string[] }
 *
 * Uses the service role key to look up auth.users emails by user IDs.
 * Returns { emails: Record<string, string> } mapping userId → email.
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
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' })
  }

  const { userIds } = req.body ?? {}
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Missing required field: userIds (array)' })
  }

  try {
    const sb = createClient(supabaseUrl, serviceKey)
    const { data: listData } = await sb.auth.admin.listUsers({ perPage: 1000 })
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
