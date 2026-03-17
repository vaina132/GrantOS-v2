import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://app.grantlume.com',
  'https://www.grantlume.com',
  'http://localhost:5173',
  'http://localhost:3000',
]

export function cors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (process.env.VERCEL_ENV === 'preview' && origin) {
    // Allow Vercel preview deployments
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string
  email: string | undefined
  orgId: string | null
  role: string | null
}

/**
 * Authenticate a request by verifying the JWT from the Authorization header.
 * Returns the authenticated user's context or throws an error.
 */
export async function authenticateRequest(req: VercelRequest): Promise<AuthContext> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError(401, 'Missing or invalid Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new AuthError(401, 'Empty bearer token')
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError(500, 'Server configuration error: missing Supabase credentials')
  }

  // Verify the JWT by calling getUser with the token
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new AuthError(401, 'Invalid or expired token')
  }

  // Look up org membership using service role (bypasses RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    // Return without org context — some endpoints may not need it
    return { userId: user.id, email: user.email, orgId: null, role: null }
  }

  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: member } = await adminClient
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    email: user.email,
    orgId: member?.org_id ?? null,
    role: member?.role ?? null,
  }
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AuthError'
  }
}

/**
 * Helper to handle auth errors in API routes.
 */
export function handleAuthError(err: unknown, res: VercelResponse) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message })
  }
  console.error('[GrantLume] Unexpected auth error:', err)
  return res.status(500).json({ error: 'Internal server error' })
}
