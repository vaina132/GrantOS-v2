import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { cors, authenticateRequest, handleAuthError } from './lib/auth.js'
import { checkRateLimit } from './lib/rateLimit.js'

/**
 * Consolidated AI & search API — replaces parse-grant, parse-collab-grant, parse-import, eu-calls.
 *
 * POST /api/ai?action=parse-grant
 * POST /api/ai?action=parse-collab-grant
 * POST /api/ai?action=parse-import
 * GET  /api/ai?action=eu-calls&q=...&pageSize=20
 */

export const config = {
  maxDuration: 120,
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

// ── AI Quota Limits per plan ──────────────────────────────────────────────
const AI_PLAN_LIMITS: Record<string, { monthly_tokens: number; monthly_requests: number }> = {
  trial:      { monthly_tokens: 200_000,   monthly_requests: 10 },
  starter:    { monthly_tokens: 500_000,   monthly_requests: 30 },
  growth:     { monthly_tokens: 2_000_000, monthly_requests: 100 },
  enterprise: { monthly_tokens: 10_000_000, monthly_requests: 500 },
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function checkQuota(
  supabase: any, orgId: string
): Promise<{ allowed: boolean; error?: string; plan?: string; usage?: any; limits?: any }> {
  if (!orgId) return { allowed: false, error: 'org_id is required for AI requests' }

  // Get org plan
  const { data: org } = await supabase
    .from('organisations')
    .select('plan')
    .eq('id', orgId)
    .single()

  const plan = org?.plan || 'trial'
  const limits = AI_PLAN_LIMITS[plan] || AI_PLAN_LIMITS.trial

  // Get current month usage
  const month = currentMonth()
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('tokens_in, tokens_out, request_count')
    .eq('org_id', orgId)
    .eq('month', month)
    .maybeSingle()

  const totalTokens = (usage?.tokens_in || 0) + (usage?.tokens_out || 0)
  const requestCount = usage?.request_count || 0

  if (totalTokens >= limits.monthly_tokens) {
    return { allowed: false, error: `AI token limit reached (${totalTokens.toLocaleString()} / ${limits.monthly_tokens.toLocaleString()} tokens used this month). Upgrade your plan for more.`, plan, usage, limits }
  }
  if (requestCount >= limits.monthly_requests) {
    return { allowed: false, error: `AI request limit reached (${requestCount} / ${limits.monthly_requests} requests this month). Upgrade your plan for more.`, plan, usage, limits }
  }

  return { allowed: true, plan, usage, limits }
}

async function recordUsage(
  supabase: any,
  orgId: string,
  userId: string,
  action: string,
  tokensIn: number,
  tokensOut: number,
) {
  const month = currentMonth()

  // Upsert monthly aggregate
  const { data: existing } = await supabase
    .from('ai_usage')
    .select('id, tokens_in, tokens_out, request_count')
    .eq('org_id', orgId)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    await supabase.from('ai_usage').update({
      tokens_in: existing.tokens_in + tokensIn,
      tokens_out: existing.tokens_out + tokensOut,
      request_count: existing.request_count + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await supabase.from('ai_usage').insert({
      org_id: orgId,
      month,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      request_count: 1,
    })
  }

  // Insert audit log entry
  await supabase.from('ai_usage_log').insert({
    org_id: orgId,
    user_id: userId,
    action,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = (req.query.action as string) || ''

  // Health check — no auth required, useful for diagnostics
  if (action === 'health' && req.method === 'GET') {
    const env = getClaudeAndSupabase()
    return res.status(200).json({
      ok: true,
      hasClaudeKey: !!process.env.CLAUDE_API_KEY,
      hasSupabaseUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasEnv: !!env,
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Rate limit: 20 AI requests per 60s per IP
    if (!checkRateLimit(req, res, { limit: 20, windowSeconds: 60, prefix: 'ai' })) return

    // Authenticate all AI requests
    let auth
    try {
      auth = await authenticateRequest(req)
    } catch (err) {
      return handleAuthError(err, res)
    }

    // Inject authenticated user context into request body for downstream handlers
    if (req.body && typeof req.body === 'object') {
      if (!req.body.org_id && auth.orgId) req.body.org_id = auth.orgId
      if (!req.body.user_id) req.body.user_id = auth.userId
    }

    switch (action) {
      case 'parse-grant':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleParseGrant(req, res)
      case 'parse-collab-grant':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleParseCollabGrant(req, res)
      case 'parse-import':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        return await handleParseImport(req, res)
      case 'eu-calls':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
        return await handleEuCalls(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: "${action}"` })
    }
  } catch (fatalErr: any) {
    // Global safety net — if any handler throws without catching, return a proper error
    console.error('[GrantLume] AI handler fatal error:', fatalErr)
    if (!res.headersSent) {
      return res.status(500).json({ error: `Unexpected server error: ${fatalErr?.message || 'Unknown'}` })
    }
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────

function getClaudeAndSupabase() {
  const claudeApiKey = process.env.CLAUDE_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!claudeApiKey || !supabaseUrl || !supabaseServiceKey) return null
  return { claudeApiKey, supabase: createClient(supabaseUrl, supabaseServiceKey) }
}

async function downloadAndExtract(supabase: any, storagePath: string, fileName: string) {
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('grant-uploads')
    .download(storagePath)

  if (downloadError || !fileData) {
    throw new Error(`Failed to download file: ${downloadError?.message || 'Not found'}`)
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const ext = (fileName || storagePath).toLowerCase().split('.').pop() || ''

  return { arrayBuffer, ext }
}

async function buildContentFromFile(arrayBuffer: ArrayBuffer, ext: string, userPromptText: string) {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
    }
    return [
      { type: 'image', source: { type: 'base64', media_type: mimeMap[ext] || 'image/jpeg', data: base64 } },
      { type: 'text', text: userPromptText },
    ]
  }

  if (ext === 'pdf') {
    // Send PDF directly to Claude's native document support — no text extraction needed
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: userPromptText },
    ]
  }

  // Word, text, etc.
  const textContent = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer))
  if (!textContent || textContent.trim().length < 10) {
    throw new Error('Could not read file contents. Please try a different format (CSV, Excel, PDF, or image).')
  }
  const maxChars = 100000
  const truncatedText = textContent.length > maxChars
    ? textContent.slice(0, maxChars) + '\n\n[Document truncated]'
    : textContent

  return [{ type: 'text', text: userPromptText + `\n\n--- DOCUMENT TEXT ---\n${truncatedText}\n--- END ---` }]
}

async function callClaude(claudeApiKey: string, systemPrompt: string, messageContent: any[]) {
  // Check if any content block is a PDF document — requires beta header
  const hasPdf = messageContent.some((b: any) => b.type === 'document' && b.source?.media_type === 'application/pdf')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': claudeApiKey,
    'anthropic-version': '2023-06-01',
  }
  if (hasPdf) {
    headers['anthropic-beta'] = 'pdfs-2024-09-25'
  }

  const claudeResponse = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  if (!claudeResponse.ok) {
    const errBody = await claudeResponse.text()
    console.error('[GrantLume] Claude API error:', claudeResponse.status, errBody)
    let details = errBody
    try { details = JSON.parse(errBody)?.error?.message || errBody } catch {}
    throw { status: 502, message: `AI extraction failed (${claudeResponse.status}): ${details}` }
  }

  const claudeData = await claudeResponse.json()
  const textBlock = claudeData.content?.find((b: any) => b.type === 'text')
  if (!textBlock?.text) {
    throw { status: 502, message: 'No text response from AI' }
  }

  return {
    text: textBlock.text,
    usage: claudeData.usage,
    tokens_in: claudeData.usage?.input_tokens || 0,
    tokens_out: claudeData.usage?.output_tokens || 0,
  }
}

function parseJsonResponse(rawText: string): any {
  let jsonStr = rawText.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '')
  }
  if (!jsonStr.startsWith('{')) {
    const jsonStart = jsonStr.indexOf('{')
    if (jsonStart >= 0) {
      jsonStr = jsonStr.substring(jsonStart)
      let depth = 0
      let jsonEnd = -1
      for (let i = 0; i < jsonStr.length; i++) {
        if (jsonStr[i] === '{') depth++
        if (jsonStr[i] === '}') depth--
        if (depth === 0) { jsonEnd = i; break }
      }
      if (jsonEnd > 0) jsonStr = jsonStr.substring(0, jsonEnd + 1)
    }
  }
  return JSON.parse(jsonStr)
}

// ════════════════════════════════════════════════════════════════════════════
// parse-grant
// ════════════════════════════════════════════════════════════════════════════

const GRANT_SYSTEM_PROMPT = `You are an expert grant agreement parser. You will receive the extracted text of a grant agreement document. Extract ALL structured information and return it as a single JSON object matching the schema below. Be thorough — extract every work package, deliverable, milestone, and reporting period you can find.

IMPORTANT RULES:
- Dates should be in ISO format (YYYY-MM-DD).
- Month numbers are project-relative (M1 = first month of the project, M2 = second, etc.).
- For "has_wps", set true if the document defines work packages.
- For "is_lead_organisation", set true if the document indicates the uploading organisation is the coordinator/lead.
- Budget fields should be numbers (no currency symbols). Use null if not found.
- "our_pm_rate" is the person-month rate for the organisation. Use null if not stated.
- "wp_number" in deliverables/milestones refers to the work package number it belongs to.
- If you cannot find a value, use null for optional fields or your best estimate for required fields.
- Include a "confidence_notes" string summarising anything you were uncertain about.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "project": {
    "acronym": "string",
    "title": "string",
    "grant_number": "string | null",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "total_budget": "number | null",
    "overhead_rate": "number | null",
    "has_wps": "boolean",
    "is_lead_organisation": "boolean",
    "our_pm_rate": "number | null",
    "budget_personnel": "number | null",
    "budget_travel": "number | null",
    "budget_subcontracting": "number | null",
    "budget_other": "number | null"
  },
  "work_packages": [
    {
      "number": "integer",
      "name": "string",
      "description": "string | null",
      "start_month": "integer",
      "end_month": "integer",
      "person_months": "number | null"
    }
  ],
  "deliverables": [
    {
      "number": "string (e.g. D1.1)",
      "title": "string",
      "description": "string | null",
      "wp_number": "integer | null",
      "due_month": "integer"
    }
  ],
  "milestones": [
    {
      "number": "string (e.g. MS1)",
      "title": "string",
      "description": "string | null",
      "wp_number": "integer | null",
      "due_month": "integer",
      "verification_means": "string | null"
    }
  ],
  "reporting_periods": [
    {
      "period_number": "integer",
      "start_month": "integer",
      "end_month": "integer"
    }
  ],
  "confidence_notes": "string"
}`

async function handleParseGrant(req: VercelRequest, res: VercelResponse) {
  try {
    const env = getClaudeAndSupabase()
    if (!env) return res.status(500).json({ error: 'Server credentials not configured' })

    const { storage_path, file_data, file_name, organisation_abbreviation, user_instructions, org_id, user_id } = req.body || {}
    if (!storage_path && !file_data) return res.status(400).json({ error: 'No storage_path or file_data provided' })

    // Quota check
    if (org_id) {
      const quota = await checkQuota(env.supabase, org_id)
      if (!quota.allowed) return res.status(429).json({ error: quota.error, quota_exceeded: true })
    }

    let arrayBuffer: ArrayBuffer
    if (file_data) {
      const buffer = Buffer.from(file_data, 'base64')
      arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } else {
      const result = await downloadAndExtract(env.supabase, storage_path, file_name)
      arrayBuffer = result.arrayBuffer
    }

    // Send PDF directly to Claude's native document support
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    let userPrompt = `Please parse this grant agreement PDF and extract all project information as the JSON schema described in the system prompt.`
    if (organisation_abbreviation) {
      userPrompt += `\n\nIMPORTANT: Our organisation's abbreviation/name is "${organisation_abbreviation}". When extracting budget figures, PM rates, and personnel costs, focus on the data specific to this organisation (not the total consortium figures). Look for budget tables or annexes that break down costs per beneficiary/partner.`
    }
    if (user_instructions) {
      userPrompt += `\n\nAdditional instructions from the user:\n${user_instructions}`
    }
    userPrompt += '\n\nReturn ONLY the JSON object.'

    const { text, usage, tokens_in, tokens_out } = await callClaude(env.claudeApiKey, GRANT_SYSTEM_PROMPT, [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: userPrompt },
    ])
    const extraction = parseJsonResponse(text)

    // Record usage
    if (org_id) {
      await recordUsage(env.supabase, org_id, user_id || 'unknown', 'parse-grant', tokens_in, tokens_out)
    }

    return res.status(200).json({ extraction, usage })
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('parse-grant error:', err)
    return res.status(500).json({ error: `Server error: ${err.message || 'Unknown error'}` })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// parse-collab-grant
// ════════════════════════════════════════════════════════════════════════════

const COLLAB_SYSTEM_PROMPT = `You are an expert EU grant agreement parser specialised in extracting collaboration project data from grant agreements, annexes, and budget tables. You extract data for a multi-partner collaboration module.

IMPORTANT RULES:
- Dates should be in ISO format (YYYY-MM-DD).
- Month numbers are project-relative (M1 = first month, M2 = second, etc.).
- Budget fields should be numbers (no currency symbols). Use null if not found.
- For country codes, use the official 2-letter ISO 3166-1 alpha-2 codes (DE, FR, IT, ES, etc.).
- For org_type, use official EU participant types: HES (Higher Education), REC (Research Organisation), PRC (Private Company), PUB (Public Body), OTH (Other).
- If you cannot find a value, use null.
- Include a "confidence_notes" string summarising anything uncertain.
- Extract ALL partners, work packages, tasks, deliverables, and milestones you can find.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "project": {
    "title": "string",
    "acronym": "string",
    "grant_number": "string | null",
    "funding_programme": "string | null",
    "funding_scheme": "string | null",
    "start_date": "YYYY-MM-DD | null",
    "end_date": "YYYY-MM-DD | null",
    "duration_months": "number | null"
  },
  "partners": [
    {
      "org_name": "string",
      "role": "coordinator | partner",
      "participant_number": "number",
      "country": "string (2-letter ISO code) | null",
      "org_type": "HES | REC | PRC | PUB | OTH | null",
      "contact_name": "string | null",
      "contact_email": "string | null",
      "budget_personnel": "number | null",
      "budget_subcontracting": "number | null",
      "budget_travel": "number | null",
      "budget_equipment": "number | null",
      "budget_other_goods": "number | null",
      "total_person_months": "number | null",
      "funding_rate": "number | null",
      "indirect_cost_rate": "number | null"
    }
  ],
  "work_packages": [
    {
      "wp_number": "number",
      "title": "string",
      "start_month": "number | null",
      "end_month": "number | null",
      "total_person_months": "number | null",
      "leader_participant_number": "number | null",
      "tasks": [
        {
          "task_number": "string (e.g. T1.1)",
          "title": "string",
          "description": "string | null",
          "start_month": "number | null",
          "end_month": "number | null",
          "leader_participant_number": "number | null",
          "person_months": "number | null"
        }
      ]
    }
  ],
  "deliverables": [
    {
      "number": "string (e.g. D1.1)",
      "title": "string",
      "description": "string | null",
      "wp_number": "number | null",
      "due_month": "number",
      "type": "report | data | software | demonstrator | other | null",
      "dissemination": "public | confidential | classified | null",
      "leader_participant_number": "number | null"
    }
  ],
  "milestones": [
    {
      "number": "string (e.g. MS1)",
      "title": "string",
      "description": "string | null",
      "wp_number": "number | null",
      "due_month": "number",
      "verification_means": "string | null"
    }
  ],
  "confidence_notes": "string"
}`

async function handleParseCollabGrant(req: VercelRequest, res: VercelResponse) {
  try {
    const env = getClaudeAndSupabase()
    if (!env) return res.status(500).json({ error: 'Server credentials not configured' })

    const { storage_path, file_data, file_name, user_instructions, org_id, user_id } = req.body || {}
    if (!storage_path && !file_data) return res.status(400).json({ error: 'No storage_path or file_data provided' })

    // Quota check
    if (org_id) {
      const quota = await checkQuota(env.supabase, org_id)
      if (!quota.allowed) return res.status(429).json({ error: quota.error, quota_exceeded: true })
    }

    let arrayBuffer: ArrayBuffer
    let ext: string
    if (file_data) {
      const buffer = Buffer.from(file_data, 'base64')
      arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      ext = (file_name || '').toLowerCase().split('.').pop() || ''
    } else {
      const result = await downloadAndExtract(env.supabase, storage_path, file_name)
      arrayBuffer = result.arrayBuffer
      ext = result.ext
    }

    let prompt = `Extract collaboration project data from this document (file: "${file_name}").`
    prompt += `\nThis is an EU-funded multi-partner project. Extract ALL project metadata, partners with their budgets, work packages with tasks, deliverables, and milestones.`
    prompt += `\nFor budget tables, look for per-partner breakdowns of: Personnel, Subcontracting, Travel & Subsistence, Equipment, and Other Goods & Services.`
    prompt += `\nReturn a JSON object matching the schema from the system prompt.`
    if (user_instructions) prompt += `\n\nAdditional instructions from the user:\n${user_instructions}`
    prompt += '\n\nReturn ONLY the JSON object.'

    const messageContent = await buildContentFromFile(arrayBuffer, ext, prompt)
    const { text, usage, tokens_in, tokens_out } = await callClaude(env.claudeApiKey, COLLAB_SYSTEM_PROMPT, messageContent)
    const extraction = parseJsonResponse(text)

    // Record usage
    if (org_id) {
      await recordUsage(env.supabase, org_id, user_id || 'unknown', 'parse-collab-grant', tokens_in, tokens_out)
    }

    // Validate
    const hasProject = extraction.project?.title || extraction.project?.acronym
    const hasPartners = Array.isArray(extraction.partners) && extraction.partners.length > 0
    const hasWPs = Array.isArray(extraction.work_packages) && extraction.work_packages.length > 0

    if (!hasProject && !hasPartners && !hasWPs) {
      return res.status(200).json({
        extraction, usage,
        warning: 'AI could not find meaningful project data in this document. Try uploading a grant agreement annex with budget tables, work packages, and partner information.',
      })
    }

    return res.status(200).json({ extraction, usage })
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[GrantLume] parse-collab-grant error:', err)
    return res.status(500).json({ error: `Server error: ${err.message || 'Unknown error'}` })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// parse-import
// ════════════════════════════════════════════════════════════════════════════

const IMPORT_SYSTEM_PROMPT = `You are an expert data extraction assistant for a grant & project management platform called GrantLume. You will receive a document (text or image) from which you need to extract structured data.

The user will tell you what type of data to extract: "persons" (staff/employees), "projects", or "proposals".

IMPORTANT RULES:
- Return ONLY a valid JSON object with a single key "rows" containing an array of extracted records.
- Dates should be in ISO format (YYYY-MM-DD) where possible.
- For numbers (budgets, FTE, salary), return numeric values without currency symbols.
- If you cannot determine a value, use null.
- Extract ALL records you can find — be thorough.
- Do not invent data. Only extract what is clearly present in the document.
- Include a "confidence" field (0-100) for each row indicating your confidence in the extraction.
- Include an "_notes" field for each row with any relevant observations.

SCHEMAS:

For "persons":
{ "rows": [{ "full_name": "string", "email": "string|null", "department": "string|null", "role": "string|null", "employment_type": "string|null", "fte": "number|null", "start_date": "YYYY-MM-DD|null", "end_date": "YYYY-MM-DD|null", "country": "string|null", "annual_salary": "number|null", "confidence": 85, "_notes": "string" }] }

For "projects":
{ "rows": [{ "acronym": "string", "title": "string", "start_date": "YYYY-MM-DD|null", "end_date": "YYYY-MM-DD|null", "status": "string|null", "grant_number": "string|null", "total_budget": "number|null", "budget_personnel": "number|null", "budget_travel": "number|null", "budget_subcontracting": "number|null", "budget_other": "number|null", "confidence": 85, "_notes": "string" }] }

For "proposals":
{ "rows": [{ "project_name": "string", "call_identifier": "string|null", "funding_scheme": "string|null", "status": "In Preparation|Submitted|Rejected|Granted|null", "submission_deadline": "YYYY-MM-DD|null", "expected_decision": "YYYY-MM-DD|null", "our_pms": "number|null", "personnel_budget": "number|null", "travel_budget": "number|null", "subcontracting_budget": "number|null", "other_budget": "number|null", "notes": "string|null", "confidence": 85, "_notes": "string" }] }

Return ONLY the JSON object. No markdown fences, no explanation.`

async function handleParseImport(req: VercelRequest, res: VercelResponse) {
  console.log('[GrantLume] parse-import: started')
  try {
    const env = getClaudeAndSupabase()
    if (!env) {
      console.error('[GrantLume] parse-import: missing env vars — CLAUDE_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY not set')
      return res.status(500).json({ error: 'Server credentials not configured. Please check CLAUDE_API_KEY and Supabase environment variables.' })
    }

    const { storage_path, file_data, file_name, import_type, user_instructions, org_id, user_id } = req.body || {}
    console.log('[GrantLume] parse-import: params', { storage_path: !!storage_path, file_data: !!file_data, file_name, import_type, org_id })
    if (!storage_path && !file_data) return res.status(400).json({ error: 'No storage_path or file_data provided' })
    if (!import_type || !['persons', 'projects', 'proposals'].includes(import_type)) {
      return res.status(400).json({ error: 'import_type must be one of: persons, projects, proposals' })
    }

    // Quota check
    if (org_id) {
      console.log('[GrantLume] parse-import: checking quota…')
      const quota = await checkQuota(env.supabase, org_id)
      if (!quota.allowed) return res.status(429).json({ error: quota.error, quota_exceeded: true })
    }

    let arrayBuffer: ArrayBuffer
    let ext: string

    if (file_data) {
      // Direct base64 file data — no storage needed
      console.log('[GrantLume] parse-import: decoding base64 file data…')
      const buffer = Buffer.from(file_data, 'base64')
      arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      ext = (file_name || '').toLowerCase().split('.').pop() || ''
      console.log('[GrantLume] parse-import: decoded, ext =', ext, 'size =', arrayBuffer.byteLength)
    } else {
      console.log('[GrantLume] parse-import: downloading file from storage…')
      const result = await downloadAndExtract(env.supabase, storage_path, file_name)
      arrayBuffer = result.arrayBuffer
      ext = result.ext
      console.log('[GrantLume] parse-import: file downloaded, ext =', ext, 'size =', arrayBuffer.byteLength)
    }

    let prompt = `Extract "${import_type}" data from this document (file: "${file_name}").`
    prompt += `\nReturn a JSON object with a "rows" array matching the "${import_type}" schema from the system prompt.`
    prompt += `\nBe thorough — extract every record you can find.`
    if (user_instructions) prompt += `\n\nAdditional instructions from the user:\n${user_instructions}`
    prompt += '\n\nReturn ONLY the JSON object.'

    console.log('[GrantLume] parse-import: building content from file…')
    const messageContent = await buildContentFromFile(arrayBuffer, ext, prompt)
    console.log('[GrantLume] parse-import: calling Claude API…')
    const { text, usage, tokens_in, tokens_out } = await callClaude(env.claudeApiKey, IMPORT_SYSTEM_PROMPT, messageContent)
    console.log('[GrantLume] parse-import: Claude responded, tokens_in =', tokens_in, 'tokens_out =', tokens_out)
    const extraction = parseJsonResponse(text)
    console.log('[GrantLume] parse-import: parsed extraction, rows =', extraction?.rows?.length ?? 0)

    // Record usage
    if (org_id) {
      await recordUsage(env.supabase, org_id, user_id || 'unknown', 'parse-import', tokens_in, tokens_out).catch((e: any) => {
        console.error('[GrantLume] parse-import: usage recording failed (non-fatal):', e)
      })
    }

    return res.status(200).json({ extraction, usage })
  } catch (err: any) {
    console.error('[GrantLume] parse-import error:', err)
    if (err.status) return res.status(err.status).json({ error: err.message })
    return res.status(500).json({ error: `Server error: ${err?.message || 'Unknown error'}` })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// eu-calls — proxy to EC Funding & Tenders Portal
// ════════════════════════════════════════════════════════════════════════════

interface EuTopic {
  identifier: string
  title: string
  callIdentifier?: string
  deadlineDate?: string
  status?: string
}

async function handleEuCalls(req: VercelRequest, res: VercelResponse) {
  const query = (req.query.q as string) ?? ''
  const pageSize = parseInt((req.query.pageSize as string) ?? '20', 10)

  if (query.length < 2) {
    return res.status(200).json({ topics: [] })
  }

  try {
    const searchUrl = new URL('https://api.tech.ec.europa.eu/search-api/prod/rest/search')
    searchUrl.searchParams.set('apiKey', 'SEDIA')
    searchUrl.searchParams.set('text', query)
    searchUrl.searchParams.set('pageSize', String(pageSize))
    searchUrl.searchParams.set('pageNumber', '1')
    searchUrl.searchParams.set('type', '1')

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'GrantLume/1.0' },
    })

    if (!response.ok) {
      return await euCallsFallback(query, pageSize, res)
    }

    const data = await response.json()
    const topics: EuTopic[] = (data.results ?? []).map((r: any) => ({
      identifier: r.metadata?.identifier?.[0] ?? r.reference ?? '',
      title: r.title ?? r.metadata?.title?.[0] ?? '',
      callIdentifier: r.metadata?.callIdentifier?.[0] ?? '',
      deadlineDate: r.metadata?.deadlineDatesLong?.[0]
        ? new Date(parseInt(r.metadata.deadlineDatesLong[0])).toISOString().slice(0, 10)
        : undefined,
      status: r.metadata?.status?.[0] ?? '',
    })).filter((t: EuTopic) => t.identifier)

    return res.status(200).json({ topics, source: 'ec-search-api' })
  } catch {
    return await euCallsFallback(query, pageSize, res)
  }
}

async function euCallsFallback(query: string, pageSize: number, res: VercelResponse) {
  try {
    const listUrl = 'https://ec.europa.eu/info/funding-tenders/opportunities/data/topic-list.json'
    const response = await fetch(listUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'GrantLume/1.0' },
    })

    if (!response.ok) return res.status(200).json({ topics: [], source: 'none' })

    const data = await response.json()
    const all: any[] = data.topicData?.Topics ?? data ?? []

    const q = query.toLowerCase()
    const filtered = all
      .filter((t: any) =>
        (t.identifier ?? '').toLowerCase().includes(q) ||
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.callIdentifier ?? '').toLowerCase().includes(q),
      )
      .slice(0, pageSize)
      .map((t: any) => ({
        identifier: t.identifier ?? '',
        title: t.title ?? '',
        callIdentifier: t.callIdentifier ?? '',
        deadlineDate: t.deadlineDate ?? undefined,
        status: t.status ?? '',
      }))

    return res.status(200).json({ topics: filtered, source: 'topic-list' })
  } catch {
    return res.status(200).json({ topics: [], source: 'error' })
  }
}
