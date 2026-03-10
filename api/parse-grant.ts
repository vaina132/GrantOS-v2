import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are an expert grant agreement parser. You will receive a grant agreement document (as PDF content). Extract ALL structured information and return it as a single JSON object matching the schema below. Be thorough — extract every work package, deliverable, milestone, and reporting period you can find.

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

export const config = {
  maxDuration: 60, // Claude may take a while for large documents
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const claudeApiKey = process.env.CLAUDE_API_KEY
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!claudeApiKey) {
      return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' })
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase credentials not configured on server' })
    }

    // Parse JSON body (small — just the storage path + metadata)
    const { storage_path, file_name, organisation_abbreviation, user_instructions } = req.body || {}

    if (!storage_path) {
      return res.status(400).json({ error: 'No storage_path provided' })
    }

    // Download file from Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('grant-uploads')
      .download(storage_path)

    if (downloadError || !fileData) {
      return res.status(400).json({ error: `Failed to download file: ${downloadError?.message || 'Not found'}` })
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Determine media type from file name
    let mediaType = 'application/pdf'
    const name = (file_name || storage_path || '').toLowerCase()
    if (name.endsWith('.png')) mediaType = 'image/png'
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mediaType = 'image/jpeg'
    else if (name.endsWith('.webp')) mediaType = 'image/webp'
    else if (name.endsWith('.gif')) mediaType = 'image/gif'

    // Build user prompt with optional context
    let userPrompt = 'Please parse this grant agreement document and extract all project information as the JSON schema described in the system prompt.'
    if (organisation_abbreviation) {
      userPrompt += `\n\nIMPORTANT: Our organisation's abbreviation/name is "${organisation_abbreviation}". When extracting budget figures, PM rates, and personnel costs, focus on the data specific to this organisation (not the total consortium figures). Look for budget tables or annexes that break down costs per beneficiary/partner.`
    }
    if (user_instructions) {
      userPrompt += `\n\nAdditional instructions from the user:\n${user_instructions}`
    }
    userPrompt += '\n\nReturn ONLY the JSON object.'

    // Build Claude API request
    const isPdf = mediaType === 'application/pdf'
    const content: any[] = isPdf
      ? [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: userPrompt },
        ]
      : [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: userPrompt },
        ]

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2024-10-22',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      console.error('Claude API error:', claudeResponse.status, errBody)
      let details = errBody
      try { details = JSON.parse(errBody)?.error?.message || errBody } catch {}
      return res.status(502).json({ error: `Claude API error (${claudeResponse.status}): ${details}` })
    }

    const claudeData = await claudeResponse.json()

    // Extract text content
    const textBlock = claudeData.content?.find((b: any) => b.type === 'text')
    if (!textBlock?.text) {
      return res.status(502).json({ error: 'No text response from Claude' })
    }

    // Parse JSON (handle possible markdown code fences)
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const extraction = JSON.parse(jsonStr)

    return res.status(200).json({ extraction, usage: claudeData.usage })
  } catch (err) {
    console.error('parse-grant error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
