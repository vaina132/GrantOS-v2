import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * Stripe Webhook Handler
 *
 * Receives webhook events from Stripe and updates the organisation's
 * subscription status accordingly.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — Stripe webhook signing secret
 *   SUPABASE_URL             — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 *
 * Stripe events handled:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_failed
 */

// Map Stripe Price IDs to GrantLume plan — will be set from env vars
// These are populated once you create the products/prices in Stripe Dashboard
function getPlan(priceId: string): string {
  const monthlyId = process.env.STRIPE_PRICE_MONTHLY || ''
  const yearlyId = process.env.STRIPE_PRICE_YEARLY || ''
  if (priceId === monthlyId || priceId === yearlyId) return 'pro'
  return 'pro' // default — only one paid plan
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeSecretKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing server credentials' })
  }

  const stripe = new Stripe(stripeSecretKey)

  // Verify webhook signature
  let event: Stripe.Event
  try {
    const sig = req.headers['stripe-signature'] as string
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } else {
      // Fallback for testing without signature verification
      event = req.body as Stripe.Event
    }
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

  // Downgrade to trial
  await supabase.from('organisations').update({
    plan: 'trial',
    subscription_status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', orgId)

  await notifyAdmins(supabase, orgId, 'subscription_cancelled',
    'Subscription Cancelled',
    'Your GrantLume Pro subscription has ended. You are now on the Free Trial plan with limited features.',
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
  if (plan !== 'trial') {
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
