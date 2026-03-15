import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

/**
 * POST /api/docusign?action=sign     — Create DocuSign envelope for signing
 * POST /api/docusign?action=webhook  — DocuSign Connect webhook callback
 *
 * Consolidated into one serverless function to stay within Vercel Hobby plan limits.
 */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const action = (req.query.action as string) || ''

  switch (action) {
    case 'sign':
      return handleSign(req, res)
    case 'webhook':
      return handleWebhook(req, res)
    default:
      return res.status(400).json({ error: `Unknown action: "${action}". Use ?action=sign or ?action=webhook` })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Action: sign — Create DocuSign envelope + get embedded signing URL
// ════════════════════════════════════════════════════════════════════════════

async function getDocuSignAccessToken(): Promise<string> {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY!
  const userId = process.env.DOCUSIGN_USER_ID!
  const rsaPrivateKey = (process.env.DOCUSIGN_RSA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const oauthBase = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com'

  // Build JWT assertion
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: integrationKey,
    sub: userId,
    aud: oauthBase.replace('https://', ''),
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(rsaPrivateKey, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  // Exchange JWT for access token
  const tokenRes = await fetch(`${oauthBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`DocuSign OAuth failed: ${tokenRes.status} — ${errText}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

function buildTimesheetHtml(params: {
  personName: string
  orgName: string
  month: string
  year: number
  totalHours: number
  workingDays: number
  days: { date: string; project: string; wp: string | null; hours: number }[]
}): string {
  // Group days by date for a clean table
  const dayMap = new Map<string, { project: string; wp: string | null; hours: number }[]>()
  for (const d of params.days) {
    if (!dayMap.has(d.date)) dayMap.set(d.date, [])
    dayMap.get(d.date)!.push({ project: d.project, wp: d.wp, hours: d.hours })
  }

  const sortedDates = Array.from(dayMap.keys()).sort()

  const rows = sortedDates.map(date => {
    const entries = dayMap.get(date)!
    return entries.map((e, i) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        ${i === 0 ? `<td rowspan="${entries.length}" style="padding:6px 10px;font-size:13px;vertical-align:top;">${date}</td>` : ''}
        <td style="padding:6px 10px;font-size:13px;">${e.project}${e.wp ? ` / ${e.wp}` : ''}</td>
        <td style="padding:6px 10px;font-size:13px;text-align:right;">${e.hours.toFixed(1)}h</td>
      </tr>
    `).join('')
  }).join('')

  return `
    <html>
    <body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:40px;">
      <div style="margin-bottom:30px;">
        <h1 style="font-size:20px;margin:0;">Monthly Timesheet</h1>
        <p style="font-size:14px;color:#6b7280;margin:4px 0 0;">${params.orgName}</p>
      </div>
      <table style="font-size:13px;margin-bottom:20px;">
        <tr><td style="padding:3px 16px 3px 0;font-weight:600;">Employee:</td><td>${params.personName}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;font-weight:600;">Period:</td><td>${params.month} ${params.year}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;font-weight:600;">Working Days:</td><td>${params.workingDays}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;font-weight:600;">Total Hours:</td><td>${params.totalHours.toFixed(1)}h</td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #d1d5db;">Date</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #d1d5db;">Project / WP</th>
            <th style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;border-bottom:2px solid #d1d5db;">Hours</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="background:#f3f4f6;font-weight:700;">
            <td colspan="2" style="padding:8px 10px;font-size:13px;border-top:2px solid #d1d5db;">Total</td>
            <td style="padding:8px 10px;font-size:13px;text-align:right;border-top:2px solid #d1d5db;">${params.totalHours.toFixed(1)}h</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:40px;">
        <p style="font-size:12px;color:#6b7280;margin-bottom:30px;">
          I hereby confirm that the hours recorded above are accurate and complete.
        </p>
        <div style="margin-top:20px;">
          <p style="font-size:11px;color:#9ca3af;">Signature:</p>
          <div style="border-bottom:1px solid #1f2937;width:300px;height:40px;"></div>
          <p style="font-size:11px;color:#9ca3af;margin-top:4px;">**signature_1**</p>
        </div>
        <div style="margin-top:16px;">
          <p style="font-size:11px;color:#9ca3af;">Date signed:</p>
          <p style="font-size:11px;color:#9ca3af;">**date_signed_1**</p>
        </div>
      </div>

      <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;">
        <p style="font-size:10px;color:#9ca3af;">Generated by GrantLume — Grant & Project Management</p>
      </div>
    </body>
    </html>
  `
}

async function handleSign(req: VercelRequest, res: VercelResponse) {
  const { orgId, personId, year, month, userId } = req.body || {}
  if (!orgId || !personId || !year || !month) {
    return res.status(400).json({ error: 'Missing orgId, personId, year, or month' })
  }

  // Validate env vars
  if (!process.env.DOCUSIGN_INTEGRATION_KEY || !process.env.DOCUSIGN_USER_ID || !process.env.DOCUSIGN_ACCOUNT_ID) {
    return res.status(500).json({ error: 'DocuSign is not configured. Set DOCUSIGN_* environment variables.' })
  }

  const supabase: any = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )

  try {
    // 1. Get person info
    const { data: person, error: pErr } = await supabase
      .from('persons')
      .select('id, full_name, email')
      .eq('id', personId)
      .single()
    if (pErr || !person) return res.status(404).json({ error: 'Person not found' })
    if (!person.email) return res.status(400).json({ error: 'Person has no email address — required for DocuSign' })

    // 2. Get org info
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .single()
    const orgName = org?.name || 'Organisation'

    // 3. Get the timesheet envelope
    const { data: envelope, error: eErr } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('org_id', orgId)
      .eq('person_id', personId)
      .eq('year', year)
      .eq('month', month)
      .single()
    if (eErr || !envelope) return res.status(404).json({ error: 'Timesheet envelope not found' })
    if (envelope.status !== 'Submitted') {
      return res.status(400).json({ error: 'Timesheet must be submitted before signing' })
    }

    // 4. Get timesheet days
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: dayRows } = await supabase
      .from('timesheet_days')
      .select('date, hours, project_id, work_package_id, projects(acronym)')
      .eq('org_id', orgId)
      .eq('person_id', personId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

    const days = (dayRows || []).map((d: any) => ({
      date: d.date,
      project: d.projects?.acronym || d.project_id,
      wp: d.work_package_id,
      hours: Number(d.hours) || 0,
    }))

    const totalHours = days.reduce((s: number, d: any) => s + d.hours, 0)
    const workingDays = envelope.working_days || 0

    // 5. Build HTML document
    const html = buildTimesheetHtml({
      personName: person.full_name,
      orgName,
      month: MONTHS[month - 1],
      year,
      totalHours,
      workingDays,
      days,
    })

    // 6. Get DocuSign access token
    const accessToken = await getDocuSignAccessToken()
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID!
    const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grantlume.com'

    // 7. Create envelope with embedded signing
    const documentBase64 = Buffer.from(html).toString('base64')

    const envelopePayload = {
      emailSubject: `Timesheet for signing: ${MONTHS[month - 1]} ${year} — ${person.full_name}`,
      emailBlurb: `Please review and sign your timesheet for ${MONTHS[month - 1]} ${year}.`,
      documents: [{
        documentId: '1',
        name: `Timesheet_${person.full_name.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.html`,
        htmlDefinition: { source: 'document' },
        documentBase64,
      }],
      recipients: {
        signers: [{
          email: person.email,
          name: person.full_name,
          recipientId: '1',
          routingOrder: '1',
          clientUserId: personId, // embedded signing
          tabs: {
            signHereTabs: [{
              anchorString: '**signature_1**',
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '-10',
            }],
            dateSignedTabs: [{
              anchorString: '**date_signed_1**',
              anchorUnits: 'pixels',
              anchorXOffset: '0',
              anchorYOffset: '-10',
            }],
          },
        }],
      },
      status: 'sent',
    }

    const createRes = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopePayload),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error('[docusign] Envelope creation failed:', errText)
      return res.status(502).json({ error: 'Failed to create DocuSign envelope', details: errText })
    }

    const envelopeData = await createRes.json()
    const envelopeId = envelopeData.envelopeId

    // 8. Get embedded signing URL (recipient view)
    const viewPayload = {
      returnUrl: `${appUrl}/timesheets?signed=1&month=${month}&year=${year}`,
      authenticationMethod: 'none',
      email: person.email,
      userName: person.full_name,
      clientUserId: personId,
    }

    const viewRes = await fetch(
      `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(viewPayload),
      },
    )

    if (!viewRes.ok) {
      const errText = await viewRes.text()
      console.error('[docusign] Recipient view failed:', errText)
      return res.status(502).json({ error: 'Failed to get signing URL', details: errText })
    }

    const viewData = await viewRes.json()
    const signingUrl = viewData.url

    // 9. Update timesheet_entries with signing info
    await supabase
      .from('timesheet_entries')
      .update({
        status: 'Signing',
        signature_status: 'sent',
        signature_envelope_id: envelopeId,
        signature_url: signingUrl,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('org_id', orgId)
      .eq('person_id', personId)
      .eq('year', year)
      .eq('month', month)

    // 10. Create in-app notification
    if (userId) {
      const { data: personUser } = await supabase
        .from('persons')
        .select('user_id')
        .eq('id', personId)
        .single()

      if (personUser?.user_id) {
        await supabase.from('notifications').insert({
          user_id: personUser.user_id,
          org_id: orgId,
          type: 'approval',
          title: 'Timesheet ready for signing',
          message: `Your timesheet for ${MONTHS[month - 1]} ${year} is ready to be signed.`,
          link: '/timesheets',
        })
      }
    }

    return res.status(200).json({
      envelopeId,
      signingUrl,
      status: 'sent',
    })
  } catch (err) {
    console.error('[docusign] Sign error:', err)
    return res.status(500).json({ error: 'Internal server error', details: String(err) })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Action: webhook — DocuSign Connect callback
// ════════════════════════════════════════════════════════════════════════════

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  // Optional HMAC verification
  const hmacKey = process.env.DOCUSIGN_CONNECT_HMAC_KEY
  if (hmacKey) {
    const hmacHeader = req.headers['x-docusign-signature-1'] as string
    if (hmacHeader) {
      const { createHmac } = await import('crypto')
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const computed = createHmac('sha256', hmacKey).update(body).digest('base64')
      if (computed !== hmacHeader) {
        console.warn('[docusign] HMAC mismatch — rejecting')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }
  }

  const supabase: any = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grantlume.com'

  try {
    const body = req.body

    // Parse envelope info from various DocuSign Connect formats
    let envelopeId: string | undefined
    let envelopeStatus: string | undefined

    if (typeof body === 'object' && body !== null) {
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
      console.warn('[docusign] No envelopeId found in webhook payload')
      return res.status(200).json({ message: 'No envelopeId — ignored' })
    }

    console.log(`[docusign] Webhook: envelope ${envelopeId} status: ${envelopeStatus}`)

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
        console.warn(`[docusign] No timesheet found for envelope ${envelopeId}`)
        return res.status(200).json({ message: 'Envelope not found — ignored' })
      }

      return await processEnvelopeUpdate(supabase, entry2, envelopeStatus, appUrl, res)
    }

    return await processEnvelopeUpdate(supabase, entry, envelopeStatus, appUrl, res)
  } catch (err) {
    console.error('[docusign] Webhook error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function processEnvelopeUpdate(
  supabase: any,
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
      .in('role', ['Admin', 'Finance Officer'])

    const personName = entry.persons?.full_name || 'A team member'
    const period = `${MONTHS[entry.month - 1]} ${entry.year}`

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          user_id: admin.user_id,
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
          const { data: userData } = await supabase.auth.admin.getUserById(admin.user_id)
          const email = userData?.user?.email
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
      await supabase.from('notifications').insert({
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
