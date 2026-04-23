import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * Consolidated Stripe API — single serverless function.
 *
 * Routes by `action` query-param:
 *   POST /api/stripe?action=create-checkout  — create Checkout Session
 *   POST /api/stripe?action=create-portal    — create Customer Portal session
 *   POST /api/stripe                         — webhook handler (default)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY,
 *   STRIPE_PRICE_YEARLY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

function getPlan(priceId: string): string {
  const monthlyId = process.env.STRIPE_PRICE_MONTHLY || ''
  const yearlyId = process.env.STRIPE_PRICE_YEARLY || ''
  if (priceId === monthlyId || priceId === yearlyId) return 'pro'
  return 'pro'
}

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

  const action = (req.query.action as string) || ''

  switch (action) {
    case 'create-checkout':
      return handleCreateCheckout(req, res, stripeSecretKey, supabaseUrl, supabaseKey)
    case 'create-portal':
      return handleCreatePortal(req, res, stripeSecretKey, supabaseUrl, supabaseKey)
    default:
      return handleWebhook(req, res, stripeSecretKey, supabaseUrl, supabaseKey)
  }
}

// ── Action: create-checkout ─────────────────────────────

async function handleCreateCheckout(
  req: VercelRequest, res: VercelResponse,
  stripeSecretKey: string, supabaseUrl: string, supabaseKey: string,
) {
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY
  const yearlyPriceId = process.env.STRIPE_PRICE_YEARLY
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
    const { data: org } = await supabase
      .from('organisations')
      .select('stripe_customer_id, name')
      .eq('id', org_id)
      .single()

    let customerId = org?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user_email,
        metadata: { org_id, org_name: org?.name || '' },
      })
      customerId = customer.id
      await supabase.from('organisations').update({ stripe_customer_id: customerId }).eq('id', org_id)
    }

    const priceId = billing_interval === 'yearly' ? yearlyPriceId : monthlyPriceId

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { org_id },
      subscription_data: { metadata: { org_id } },
      success_url: `${req.headers.origin || 'https://app.grantlume.com'}/settings?tab=subscription&upgraded=true`,
      cancel_url: `${req.headers.origin || 'https://app.grantlume.com'}/settings?tab=subscription`,
      allow_promotion_codes: true,
    }

    if (promo_code) {
      try {
        const promoCodes = await stripe.promotionCodes.list({ code: promo_code, active: true, limit: 1 })
        if (promoCodes.data.length > 0) {
          delete sessionParams.allow_promotion_codes
          sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }]
        }
      } catch {
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

// ── Action: create-portal ───────────────────────────────

async function handleCreatePortal(
  req: VercelRequest, res: VercelResponse,
  stripeSecretKey: string, supabaseUrl: string, supabaseKey: string,
) {
  const { org_id } = req.body || {}
  if (!org_id) return res.status(400).json({ error: 'Missing org_id' })

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

// ── Default: Webhook handler ────────────────────────────

async function handleWebhook(
  req: VercelRequest, res: VercelResponse,
  stripeSecretKey: string, supabaseUrl: string, supabaseKey: string,
) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripe = new Stripe(stripeSecretKey)

  // Signature verification is mandatory. Without a secret, unsigned events
  // could be forged by anyone — treat missing env var as a hard 500.
  if (!webhookSecret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET not set — refusing unsigned events')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  let event: Stripe.Event
  try {
    const sig = req.headers['stripe-signature'] as string
    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' })
    }
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error('[stripe] Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const supabase: any = createClient(supabaseUrl, supabaseKey)
  console.log(`[stripe] Received event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return handleCheckoutCompleted(stripe, supabase, event.data.object as Stripe.Checkout.Session, res)
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription, res)
      case 'customer.subscription.deleted':
        return handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription, res)
      case 'invoice.payment_failed':
        return handlePaymentFailed(supabase, event.data.object as Stripe.Invoice, res)
      default:
        return res.status(200).json({ received: true, event: event.type })
    }
  } catch (err: any) {
    console.error(`[stripe] Error handling ${event.type}:`, err)
    return res.status(500).json({ error: 'Internal error processing webhook' })
  }
}

// ── Event handlers ──────────────────────────────────────

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: any,
  session: Stripe.Checkout.Session,
  res: VercelResponse,
) {
  const orgId = session.metadata?.org_id
  if (!orgId) {
    console.warn('[stripe] checkout.session.completed — no org_id in metadata')
    return res.status(200).json({ received: true, warning: 'no org_id' })
  }

  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  // Expand subscription to get the price
  let plan = 'pro'
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = sub.items.data[0]?.price?.id
      if (priceId) plan = getPlan(priceId)
    } catch { /* use default */ }
  }

  await updateOrg(supabase, orgId, plan, subscriptionId, customerId, 'active')

  // Create in-app notification
  await notifyAdmins(supabase, orgId, 'subscription_upgraded',
    'Welcome to GrantLume Pro!',
    'Your subscription is now active. Enjoy unlimited projects, staff, and enhanced AI limits.',
    '/settings?tab=subscription',
  )

  return res.status(200).json({ ok: true, org_id: orgId, plan })
}

async function handleSubscriptionUpdated(
  supabase: any,
  subscription: Stripe.Subscription,
  res: VercelResponse,
) {
  const orgId = subscription.metadata?.org_id
  const customerId = subscription.customer as string

  // Try org_id from metadata, else look up by stripe_customer_id
  const resolvedOrgId = orgId || (await findOrgByStripeCustomer(supabase, customerId))?.id
  if (!resolvedOrgId) {
    return res.status(200).json({ received: true, warning: 'no org found' })
  }

  const priceId = subscription.items.data[0]?.price?.id
  const plan = priceId ? getPlan(priceId) : 'pro'

  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'past_due',
    canceled: 'cancelled',
    incomplete: 'incomplete',
    incomplete_expired: 'expired',
    trialing: 'trialing',
    paused: 'paused',
  }
  const status = statusMap[subscription.status] || subscription.status

  await updateOrg(supabase, resolvedOrgId, plan, subscription.id, customerId, status)

  return res.status(200).json({ ok: true, org_id: resolvedOrgId, status })
}

async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription,
  res: VercelResponse,
) {
  const customerId = subscription.customer as string
  const orgId = subscription.metadata?.org_id || (await findOrgByStripeCustomer(supabase, customerId))?.id
  if (!orgId) return res.status(200).json({ received: true })

  // Downgrade to free plan
  await supabase.from('organisations').update({
    plan: 'free',
    subscription_status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', orgId)

  await notifyAdmins(supabase, orgId, 'subscription_cancelled',
    'Subscription Cancelled',
    'Your GrantLume Pro subscription has ended. You are now on the Free plan with limited features. Upgrade anytime to restore full access.',
    '/settings?tab=subscription',
  )

  return res.status(200).json({ ok: true })
}

async function handlePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice,
  res: VercelResponse,
) {
  const customerId = invoice.customer as string
  const org = await findOrgByStripeCustomer(supabase, customerId)
  if (!org) return res.status(200).json({ received: true })

  await supabase.from('organisations').update({
    subscription_status: 'past_due',
    updated_at: new Date().toISOString(),
  }).eq('id', org.id)

  await notifyAdmins(supabase, org.id, 'payment_failed',
    'Payment Failed',
    'Your last payment could not be processed. Please update your payment method to avoid service interruption.',
    '/settings?tab=subscription',
  )

  return res.status(200).json({ ok: true })
}

// ── Helpers ─────────────────────────────────────────────

async function findOrgByStripeCustomer(supabase: any, customerId: string) {
  const { data } = await supabase
    .from('organisations')
    .select('id, plan')
    .eq('stripe_customer_id', customerId)
    .single()
  return data
}

async function updateOrg(
  supabase: any,
  orgId: string,
  plan: string,
  subscriptionId?: string,
  customerId?: string,
  status?: string,
) {
  const update: any = {
    plan,
    subscription_status: status || 'active',
    updated_at: new Date().toISOString(),
  }
  if (subscriptionId) update.stripe_subscription_id = subscriptionId
  if (customerId) update.stripe_customer_id = customerId

  // Clear trial_ends_at when moving to a paid plan
  if (plan === 'pro') {
    update.trial_ends_at = null
  }

  await supabase.from('organisations').update(update).eq('id', orgId)
}

async function notifyAdmins(
  supabase: any,
  orgId: string,
  type: string,
  title: string,
  body: string,
  link: string,
) {
  try {
    const { data: admins } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'Admin')

    if (!admins?.length) return

    const notifications = admins.map((a: any) => ({
      user_id: a.user_id,
      org_id: orgId,
      type,
      title,
      body,
      link,
    }))

    await supabase.from('notifications').insert(notifications)
  } catch (err) {
    console.error('[stripe] Failed to create notifications:', err)
  }
}
