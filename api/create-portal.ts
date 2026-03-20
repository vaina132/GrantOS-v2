import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 *
 * POST /api/create-portal
 * Body: { org_id }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeSecretKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing server credentials' })
  }

  const { org_id } = req.body || {}
  if (!org_id) {
    return res.status(400).json({ error: 'Missing org_id' })
  }

  const stripe = new Stripe(stripeSecretKey)
  const supabase: any = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: org } = await supabase
      .from('organisations')
      .select('stripe_customer_id')
      .eq('id', org_id)
      .single()

    if (!org?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found. Please subscribe first.' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${req.headers.origin || 'https://app.grantlume.com'}/settings?tab=subscription`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe] Error creating portal session:', err)
    return res.status(500).json({ error: err.message || 'Failed to create portal session' })
  }
}
