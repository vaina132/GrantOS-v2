/**
 * Stripe.js initialization
 *
 * Loads Stripe.js and exposes a singleton for checkout redirects.
 *
 * Required env var: VITE_STRIPE_PUBLISHABLE_KEY
 */

import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn('[GrantLume] VITE_STRIPE_PUBLISHABLE_KEY not set — billing disabled')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}
