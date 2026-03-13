import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { signupConfirmationEmail } from './emails/templates.js'

/**
 * Supabase Auth Hook — Send Email
 *
 * Configure in Supabase Dashboard → Authentication → Hooks → Send Email Hook → HTTP
 * URL: https://app.grantlume.com/api/auth-hook
 * HTTP Signing Secret: must match AUTH_HOOK_SECRET env var
 *
 * This replaces Supabase's default email templates with our branded ones.
 * Supabase sends a POST with:
 * {
 *   user: { email, user_metadata, ... },
 *   email_data: { token, token_hash, redirect_to, email_action_type, ... }
 * }
 *
 * email_action_type can be: 'signup', 'recovery', 'invite', 'magiclink', 'email_change'
 */

const FROM_ADDRESS = 'GrantLume <notifications@grantlume.com>'
const APP_URL = 'https://app.grantlume.com'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify the hook secret if configured
  const hookSecret = process.env.AUTH_HOOK_SECRET
  if (hookSecret) {
    const authHeader = req.headers['authorization']
    if (!authHeader || authHeader !== `Bearer ${hookSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[AuthHook] RESEND_API_KEY not configured')
    return res.status(500).json({ error: 'Email service not configured' })
  }

  try {
    const { user, email_data } = req.body ?? {}

    if (!user?.email || !email_data) {
      console.error('[AuthHook] Missing user or email_data in payload')
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const email = user.email
    const firstName = user.user_metadata?.first_name || email.split('@')[0]
    const actionType = email_data.email_action_type
    const tokenHash = email_data.token_hash
    const redirectTo = email_data.redirect_to || `${APP_URL}/auth/callback`

    console.log(`[AuthHook] Processing ${actionType} email for ${email}`)

    let subject: string
    let html: string

    // Build confirmation URL that goes through our AuthCallbackPage
    const confirmUrl = `${APP_URL}/auth/callback?token_hash=${tokenHash}&type=${actionType === 'signup' ? 'signup' : 'email'}`

    switch (actionType) {
      case 'signup': {
        const template = signupConfirmationEmail({ firstName, confirmUrl })
        subject = template.subject
        html = template.html
        break
      }

      case 'recovery': {
        // Password recovery — redirect to our reset password page
        const resetUrl = `${APP_URL}/auth/callback?token_hash=${tokenHash}&type=recovery`
        // Use a simple branded layout for recovery
        subject = 'Reset your GrantLume password'
        html = buildRecoveryEmail(firstName, resetUrl)
        break
      }

      case 'email_change': {
        const verifyUrl = `${APP_URL}/auth/callback?token_hash=${tokenHash}&type=email`
        subject = 'Confirm your new email address'
        html = buildEmailChangeEmail(firstName, verifyUrl)
        break
      }

      case 'magiclink': {
        const magicUrl = `${APP_URL}/auth/callback?token_hash=${tokenHash}&type=magiclink`
        subject = 'Your GrantLume login link'
        html = buildMagicLinkEmail(firstName, magicUrl)
        break
      }

      default: {
        // Unknown type — let Supabase handle it by returning an error
        console.warn(`[AuthHook] Unknown action type: ${actionType}, falling through`)
        return res.status(422).json({ error: `Unsupported email action: ${actionType}` })
      }
    }

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html,
    })

    if (error) {
      console.error('[AuthHook] Resend error:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`[AuthHook] Email sent successfully: ${data?.id}`)
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[AuthHook] Unexpected error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ── Brand palette (matching templates.ts) ──────────────
const BRAND     = '#0d9488'
const NAVY      = '#1a2744'
const GOLD      = '#f59e0b'
const MUTED     = '#6b7280'
const TEXT      = '#1f2937'
const TEXT_SEC  = '#4b5563'
const BG        = '#f8fafc'
const CARD_BG   = '#ffffff'
const BORDER    = '#e2e8f0'

const LOGO_SVG = `<svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8 26 L14 20 L22 32 L40 8" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="M38 6 L39.2 2 L40.4 6 L44 7.2 L40.4 8.4 L39.2 12 L38 8.4 L34 7.2 Z" fill="${GOLD}"/>
</svg>`

const WORDMARK = `<span style="font-size:20px;font-weight:700;letter-spacing:-0.3px;">
<span style="color:white;">Grant</span><span style="color:#6ee7b7;">Lume</span>
</span>`

function brandedLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
<tr><td style="background:linear-gradient(135deg,${NAVY} 0%,#243456 100%);padding:28px 36px;">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle;">${LOGO_SVG}</td>
    <td style="padding-left:14px;vertical-align:middle;">${WORDMARK}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:36px 36px 32px;">${body}</td></tr>
<tr><td style="padding:0 36px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};padding-top:20px;">
    <tr><td style="font-size:12px;color:${MUTED};line-height:1.5;">
      <p style="margin:0;">© ${new Date().getFullYear()} GrantLume · <a href="https://grantlume.com" style="color:${BRAND};text-decoration:none;">grantlume.com</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${NAVY};line-height:1.3;">${text}</h1>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${TEXT};">${text}</p>`
}

function button(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${BRAND};border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">${label}</a>
</td></tr></table>`
}

function buildRecoveryEmail(firstName: string, resetUrl: string): string {
  return brandedLayout('Reset Password', [
    heading('Reset your password'),
    paragraph(`Hi ${firstName}, we received a request to reset your password. Click the button below to set a new one.`),
    button('Reset Password', resetUrl),
    paragraph(`<span style="font-size:13px;color:${MUTED};">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</span>`),
  ].join(''))
}

function buildEmailChangeEmail(firstName: string, verifyUrl: string): string {
  return brandedLayout('Confirm Email', [
    heading('Confirm your new email'),
    paragraph(`Hi ${firstName}, please click below to confirm your new email address.`),
    button('Confirm New Email', verifyUrl),
    paragraph(`<span style="font-size:13px;color:${MUTED};">If you didn't request an email change, please contact support immediately.</span>`),
  ].join(''))
}

function buildMagicLinkEmail(firstName: string, magicUrl: string): string {
  return brandedLayout('Login Link', [
    heading('Your login link'),
    paragraph(`Hi ${firstName}, click the button below to sign in to GrantLume.`),
    button('Sign In to GrantLume', magicUrl),
    paragraph(`<span style="font-size:13px;color:${MUTED};">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</span>`),
  ].join(''))
}
