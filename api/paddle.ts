import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

/**
 * Paddle Webhook Handler
 *
 * Receives webhook events from Paddle and updates the organisation's
 * subscription status accordingly.
 *
 * Required environment variables:
 *   PADDLE_WEBHOOK_SECRET  — Paddle webhook signing secret
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 *
 * Paddle sends events like:
 *   subscription.created, subscription.updated, subscription.canceled,
 *   subscription.paused, subscription.resumed, subscription.past_due,
 *   transaction.completed, transaction.payment_failed
 */

// Map Paddle price IDs to GrantLume plan names
// TODO: Replace with actual Paddle price IDs once created
const PRICE_TO_PLAN: Record<string, string> = {
  // 'pri_starter_monthly': 'starter',
  // 'pri_starter_yearly': 'starter',
  // 'pri_growth_monthly': 'growth',
  // 'pri_growth_yearly': 'growth',
  // 'pri_enterprise_monthly': 'enterprise',
  // 'pri_enterprise_yearly': 'enterprise',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' })
  }

  // Verify webhook signature (if secret is configured)
  if (webhookSecret) {
    const signature = req.headers['paddle-signature'] as string
    if (!signature || !verifyPaddleSignature(req.body, signature, webhookSecret)) {
      console.error('[paddle] Invalid webhook signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }
  }

  const supabase: any = createClient(supabaseUrl, supabaseKey)
  const event = req.body

  const eventType = event?.event_type
  const data = event?.data

  if (!eventType || !data) {
    return res.status(400).json({ error: 'Invalid webhook payload' })
  }

  console.log(`[paddle] Received event: ${eventType}`)

  try {
    switch (eventType) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.resumed':
        return handleSubscriptionActive(supabase, data, res)

      case 'subscription.canceled':
        return handleSubscriptionCanceled(supabase, data, res)

      case 'subscription.paused':
        return handleSubscriptionPaused(supabase, data, res)

      case 'subscription.past_due':
        return handleSubscriptionPastDue(supabase, data, res)

      case 'transaction.completed':
        return handleTransactionCompleted(supabase, data, res)

      default:
        // Acknowledge events we don't handle
        return res.status(200).json({ received: true, event: eventType })
    }
  } catch (err: any) {
    console.error(`[paddle] Error handling ${eventType}:`, err)
    return res.status(500).json({ error: 'Internal error processing webhook' })
  }
}

// ── Webhook signature verification ──────────────────────

function verifyPaddleSignature(payload: any, signature: string, secret: string): boolean {
  try {
    // Paddle v2 uses ts=...;h1=... format
    const parts: Record<string, string> = {}
    for (const part of signature.split(';')) {
      const [key, value] = part.split('=')
      if (key && value) parts[key] = value
    }

    const ts = parts['ts']
    const h1 = parts['h1']
    if (!ts || !h1) return false

    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
    const signedPayload = `${ts}:${body}`
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')

    return crypto.timingSafeEqual(Buffer.from(h1), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

// ── Helpers ─────────────────────────────────────────────

function extractOrgId(data: any): string | null {
  return data?.custom_data?.org_id ?? null
}

function extractPlan(data: any): string | null {
  // Try to find the plan from the price ID in the subscription items
  const items = data?.items ?? []
  for (const item of items) {
    const priceId = item?.price?.id
    if (priceId && PRICE_TO_PLAN[priceId]) {
      return PRICE_TO_PLAN[priceId]
    }
  }
  return null
}

async function findOrgByPaddleCustomer(supabase: any, customerId: string) {
  const { data } = await supabase
    .from('organisations')
    .select('id, plan')
    .eq('paddle_customer_id', customerId)
    .single()
  return data
}

// ── Event handlers ──────────────────────────────────────

async function handleSubscriptionActive(supabase: any, data: any, res: VercelResponse) {
  const orgId = extractOrgId(data)
  const customerId = data?.customer_id
  const subscriptionId = data?.id
  const plan = extractPlan(data) || 'starter'

  if (!orgId && customerId) {
    // Try to find org by paddle customer ID
    const org = await findOrgByPaddleCustomer(supabase, customerId)
    if (org) {
      await updateOrg(supabase, org.id, plan, subscriptionId, customerId, 'active')
      return res.status(200).json({ ok: true, org_id: org.id, plan })
    }
  }

  if (!orgId) {
    console.warn('[paddle] subscription.active — no org_id in custom_data and no matching customer')
    return res.status(200).json({ received: true, warning: 'no org_id' })
  }

  await updateOrg(supabase, orgId, plan, subscriptionId, customerId, 'active')

  // Create in-app notification for admins
  await notifyAdmins(supabase, orgId, 'subscription_upgraded',
    `Your plan has been upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`,
    `Your GrantLume subscription is now active. Enjoy your enhanced limits.`,
    '/settings?tab=subscription',
  )

  return res.status(200).json({ ok: true, org_id: orgId, plan })
}

async function handleSubscriptionCanceled(supabase: any, data: any, res: VercelResponse) {
  const orgId = extractOrgId(data) || (data?.customer_id ? (await findOrgByPaddleCustomer(supabase, data.customer_id))?.id : null)
  if (!orgId) return res.status(200).json({ received: true })

  await supabase.from('organisations').update({
    subscription_status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', orgId)

  await notifyAdmins(supabase, orgId, 'subscription_cancelled',
    'Subscription Cancelled',
    'Your GrantLume subscription has been cancelled. Access continues until the end of your billing period.',
    '/settings?tab=subscription',
  )

  return res.status(200).json({ ok: true })
}

async function handleSubscriptionPaused(supabase: any, data: any, res: VercelResponse) {
  const orgId = extractOrgId(data) || (data?.customer_id ? (await findOrgByPaddleCustomer(supabase, data.customer_id))?.id : null)
  if (!orgId) return res.status(200).json({ received: true })

  await supabase.from('organisations').update({
    subscription_status: 'paused',
    updated_at: new Date().toISOString(),
  }).eq('id', orgId)

  return res.status(200).json({ ok: true })
}

async function handleSubscriptionPastDue(supabase: any, data: any, res: VercelResponse) {
  const orgId = extractOrgId(data) || (data?.customer_id ? (await findOrgByPaddleCustomer(supabase, data.customer_id))?.id : null)
  if (!orgId) return res.status(200).json({ received: true })

  await supabase.from('organisations').update({
    subscription_status: 'past_due',
    updated_at: new Date().toISOString(),
  }).eq('id', orgId)

  await notifyAdmins(supabase, orgId, 'subscription_past_due',
    'Payment Failed',
    'Your last payment could not be processed. Please update your payment method to avoid service interruption.',
    '/settings?tab=subscription',
  )

  return res.status(200).json({ ok: true })
}

async function handleTransactionCompleted(supabase: any, data: any, res: VercelResponse) {
  // Transaction completed — useful for one-time charges or first payment
  // The subscription.created event handles most of the logic
  return res.status(200).json({ received: true, event: 'transaction.completed' })
}

// ── Update org helper ───────────────────────────────────

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
  if (subscriptionId) update.paddle_subscription_id = subscriptionId
  if (customerId) update.paddle_customer_id = customerId

  // Clear trial_ends_at when moving to a paid plan
  if (plan !== 'trial') {
    update.trial_ends_at = null
  }

  await supabase.from('organisations').update(update).eq('id', orgId)
}

// ── Notify admins ───────────────────────────────────────

async function notifyAdmins(
  supabase: any,
  orgId: string,
  type: string,
  title: string,
  message: string,
  link: string,
) {
  const { data: admins } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'Admin')

  if (!admins || admins.length === 0) return

  const notifications = admins.map((a: any) => ({
    user_id: a.user_id,
    org_id: orgId,
    type,
    title,
    message,
    link,
  }))

  await supabase.from('notifications').insert(notifications)
}
