import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

/**
 * POST /api/docusign-webhook
 *
 * DocuSign Connect webhook — called when an envelope status changes.
 * Updates the timesheet_entries row and sends notifications.
 *
 * Configure in DocuSign Admin → Connect:
 *   URL: https://app.grantlume.com/api/docusign-webhook
 *   Trigger events: Envelope Completed, Envelope Declined, Envelope Voided
 *   Include document: Yes (for signed PDF URL)
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NEXT_PUBLIC_APP_URL
 * Optional: DOCUSIGN_CONNECT_HMAC_KEY (for signature verification)
 */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Optional HMAC verification
  const hmacKey = process.env.DOCUSIGN_CONNECT_HMAC_KEY
  if (hmacKey) {
    const hmacHeader = req.headers['x-docusign-signature-1'] as string
    if (hmacHeader) {
      const { createHmac } = await import('crypto')
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const computed = createHmac('sha256', hmacKey).update(body).digest('base64')
      if (computed !== hmacHeader) {
        console.warn('[docusign-webhook] HMAC mismatch — rejecting')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grantlume.com'

  try {
    // DocuSign Connect sends XML by default, but can be configured for JSON
    // We handle both — parse the envelope status from the payload
    const body = req.body

    // JSON payload structure (DocuSign Connect JSON format)
    let envelopeId: string | undefined
    let envelopeStatus: string | undefined

    if (typeof body === 'object' && body !== null) {
      // JSON format
      envelopeId = body.envelopeId || body.EnvelopeID || body.data?.envelopeId
      envelopeStatus = body.status || body.Status || body.data?.envelopeSummary?.status

      // DocuSign Connect v2 format
      if (!envelopeId && body.data?.envelopeSummary) {
        envelopeId = body.data.envelopeSummary.envelopeId
        envelopeStatus = body.data.envelopeSummary.status
      }

      // Envelope event format
      if (!envelopeId && body.event) {
        envelopeId = body.data?.envelopeId
        envelopeStatus = body.event === 'envelope-completed' ? 'completed'
          : body.event === 'envelope-declined' ? 'declined'
          : body.event === 'envelope-voided' ? 'voided'
          : body.event
      }
    }

    if (!envelopeId) {
      console.warn('[docusign-webhook] No envelopeId found in payload')
      return res.status(200).json({ message: 'No envelopeId — ignored' })
    }

    console.log(`[docusign-webhook] Envelope ${envelopeId} status: ${envelopeStatus}`)

    // Look up the timesheet by envelope ID
    const { data: entry, error: eErr } = await supabase
      .from('timesheet_entries')
      .select('*, persons!timesheet_entries_person_id_fkey(full_name, email, user_id)')
      .eq('signature_envelope_id', envelopeId)
      .single()

    if (eErr || !entry) {
      // Try without join in case FK name is wrong
      const { data: entry2 } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('signature_envelope_id', envelopeId)
        .single()

      if (!entry2) {
        console.warn(`[docusign-webhook] No timesheet found for envelope ${envelopeId}`)
        return res.status(200).json({ message: 'Envelope not found — ignored' })
      }

      // Process with entry2 (no join)
      return await processEnvelopeUpdate(supabase, entry2 as any, envelopeStatus, appUrl, res)
    }

    return await processEnvelopeUpdate(supabase, entry as any, envelopeStatus, appUrl, res)
  } catch (err) {
    console.error('[docusign-webhook] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function processEnvelopeUpdate(
  supabase: ReturnType<typeof createClient>,
  entry: any,
  envelopeStatus: string | undefined,
  appUrl: string,
  res: VercelResponse,
) {
  const normalizedStatus = (envelopeStatus || '').toLowerCase()
  const now = new Date().toISOString()

  if (normalizedStatus === 'completed' || normalizedStatus === 'signed') {
    // Signing completed
    await supabase
      .from('timesheet_entries')
      .update({
        status: 'Signed',
        signature_status: 'signed',
        signed_at: now,
        updated_at: now,
      } as any)
      .eq('id', entry.id)

    // Notify admins that a timesheet has been signed
    const { data: admins } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('org_id', entry.org_id)
      .in('role', ['Admin', 'Project Manager'])

    const personName = entry.persons?.full_name || 'A team member'
    const period = `${MONTHS[entry.month - 1]} ${entry.year}`

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await (supabase as any).from('notifications').insert({
          user_id: (admin as any).user_id,
          org_id: entry.org_id,
          type: 'approval',
          title: 'Timesheet signed',
          message: `${personName} has signed their timesheet for ${period}. Ready for approval.`,
          link: '/timesheets',
        }).catch(() => {})
      }
    }

    // Send email to admins
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey && admins) {
        const resend = new Resend(resendKey)
        const from = 'GrantLume <notifications@grantlume.com>'

        for (const admin of admins) {
          const { data: userData } = await supabase.auth.admin.getUserById((admin as any).user_id)
          const email = (userData as any)?.user?.email
          if (email) {
            await resend.emails.send({
              from,
              to: email,
              subject: `Timesheet signed: ${personName} — ${period}`,
              html: `
                <p>Hi,</p>
                <p><strong>${personName}</strong> has signed their timesheet for <strong>${period}</strong>.</p>
                <p>The timesheet is now ready for your review and approval.</p>
                <p><a href="${appUrl}/timesheets">Review Timesheets</a></p>
                <p style="font-size:12px;color:#6b7280;">GrantLume — Grant & Project Management</p>
              `,
            }).catch(() => {})
          }
        }
      }
    } catch { /* email is best-effort */ }

    return res.status(200).json({ message: 'Timesheet marked as signed', envelopeId: entry.signature_envelope_id })

  } else if (normalizedStatus === 'declined') {
    // Signer declined
    await supabase
      .from('timesheet_entries')
      .update({
        status: 'Draft',
        signature_status: 'declined',
        signature_url: null,
        updated_at: now,
      } as any)
      .eq('id', entry.id)

    // Notify the person
    if (entry.persons?.user_id) {
      await (supabase as any).from('notifications').insert({
        user_id: entry.persons.user_id,
        org_id: entry.org_id,
        type: 'warning',
        title: 'Signing declined',
        message: `Your timesheet signing for ${MONTHS[entry.month - 1]} ${entry.year} was declined. You can re-submit and try again.`,
        link: '/timesheets',
      }).catch(() => {})
    }

    return res.status(200).json({ message: 'Timesheet signing declined, reverted to Draft' })

  } else if (normalizedStatus === 'voided') {
    // Envelope voided (admin action)
    await supabase
      .from('timesheet_entries')
      .update({
        status: 'Draft',
        signature_status: 'voided',
        signature_url: null,
        signature_envelope_id: null,
        updated_at: now,
      } as any)
      .eq('id', entry.id)

    return res.status(200).json({ message: 'Timesheet envelope voided, reverted to Draft' })
  }

  // Unknown status — just acknowledge
  return res.status(200).json({ message: `Unhandled status: ${envelopeStatus}` })
}
