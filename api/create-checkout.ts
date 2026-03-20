import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * Create a Stripe Checkout Session for subscription.
 *
 * POST /api/create-checkout
 * Body: { org_id, user_email, billing_interval: 'monthly' | 'yearly', promo_code?: string }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_MONTHLY   — Stripe Price ID for 149€/mo
 *   STRIPE_PRICE_YEARLY    — Stripe Price ID for 1490€/yr
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
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY
  const yearlyPriceId = process.env.STRIPE_PRICE_YEARLY

  if (!stripeSecretKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing server credentials' })
  }

  if (!monthlyPriceId || !yearlyPriceId) {
    return res.status(500).json({ error: 'Stripe price IDs not configured' })
  }

  const { org_id, user_email, billing_interval, promo_code } = req.body || {}

  if (!org_id || !user_email || !billing_interval) {
    return res.status(400).json({ error: 'Missing required fields: org_id, user_email, billing_interval' })
  }

  const stripe = new Stripe(stripeSecretKey)
  const supabase: any = createClient(supabaseUrl, supabaseKey)

  try {
    // Check if org already has a Stripe customer
    const { data: org } = await supabase
      .from('organisations')
      .select('stripe_customer_id, name')
      .eq('id', org_id)
      .single()

    let customerId = org?.stripe_customer_id

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user_email,
        metadata: { org_id, org_name: org?.name || '' },
      })
      customerId = customer.id

      // Store customer ID immediately
      await supabase
        .from('organisations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org_id)
    }

    // Choose price
    const priceId = billing_interval === 'yearly' ? yearlyPriceId : monthlyPriceId

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { org_id },
      subscription_data: {
        metadata: { org_id },
      },
      success_url: `${req.headers.origin || 'https://app.grantlume.com'}/settings?tab=subscription&upgraded=true`,
      cancel_url: `${req.headers.origin || 'https://app.grantlume.com'}/settings?tab=subscription`,
      allow_promotion_codes: true,
    }

    // If a specific promo code is provided, try to find and apply it
    if (promo_code) {
      try {
        const promoCodes = await stripe.promotionCodes.list({
          code: promo_code,
          active: true,
          limit: 1,
        })
        if (promoCodes.data.length > 0) {
          // When using discounts, we can't use allow_promotion_codes
          delete sessionParams.allow_promotion_codes
          sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }]
        }
      } catch {
        // If promo lookup fails, still allow manual entry
        console.warn(`[stripe] Promo code lookup failed for: ${promo_code}`)
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe] Error creating checkout session:', err)
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' })
  }
}
