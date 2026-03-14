import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are an expert EU grant agreement parser specialised in extracting collaboration project data from grant agreements, annexes, and budget tables. You extract data for a multi-partner collaboration module.

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

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const claudeApiKey = process.env.CLAUDE_API_KEY
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!claudeApiKey) return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' })
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'Supabase credentials not configured' })

    const { storage_path, file_name, user_instructions } = req.body || {}

    if (!storage_path) return res.status(400).json({ error: 'No storage_path provided' })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('grant-uploads')
      .download(storage_path)

    if (downloadError || !fileData) {
      return res.status(400).json({ error: `Failed to download file: ${downloadError?.message || 'Not found'}` })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const ext = (file_name || storage_path).toLowerCase().split('.').pop() || ''

    let messageContent: any[]

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp',
      }
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeMap[ext] || 'image/jpeg', data: base64 },
        },
        {
          type: 'text',
          text: buildUserPrompt(file_name, user_instructions),
        },
      ]
    } else if (ext === 'pdf') {
      const { extractText } = await import('unpdf')
      const { text: pdfPages } = await extractText(new Uint8Array(arrayBuffer))
      const pdfText = pdfPages.join('\n')

      if (!pdfText || pdfText.trim().length < 20) {
        return res.status(400).json({
          error: 'Could not extract text from PDF. The file may be scanned/image-based. Try uploading as an image instead.',
        })
      }

      const maxChars = 180000
      const truncatedText = pdfText.length > maxChars
        ? pdfText.slice(0, maxChars) + '\n\n[Document truncated]'
        : pdfText

      messageContent = [{
        type: 'text',
        text: buildUserPrompt(file_name, user_instructions) +
          `\n\n--- DOCUMENT TEXT ---\n${truncatedText}\n--- END ---`,
      }]
    } else {
      const textContent = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer))

      if (!textContent || textContent.trim().length < 10) {
        return res.status(400).json({
          error: 'Could not read file contents. Please try PDF or image format.',
        })
      }

      const maxChars = 100000
      const truncatedText = textContent.length > maxChars
        ? textContent.slice(0, maxChars) + '\n\n[Document truncated]'
        : textContent

      messageContent = [{
        type: 'text',
        text: buildUserPrompt(file_name, user_instructions) +
          `\n\n--- DOCUMENT TEXT ---\n${truncatedText}\n--- END ---`,
      }]
    }

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: messageContent }],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      console.error('[GrantLume] Claude API error:', claudeResponse.status, errBody)
      let details = errBody
      try { details = JSON.parse(errBody)?.error?.message || errBody } catch {}
      return res.status(502).json({ error: `AI extraction failed (${claudeResponse.status}): ${details}` })
    }

    const claudeData = await claudeResponse.json()
    console.log('[GrantLume] Claude response stop_reason:', claudeData.stop_reason, 'usage:', JSON.stringify(claudeData.usage))

    const textBlock = claudeData.content?.find((b: any) => b.type === 'text')
    if (!textBlock?.text) {
      console.error('[GrantLume] No text block in Claude response. Content types:', claudeData.content?.map((b: any) => b.type))
      return res.status(502).json({ error: 'No response from AI. The document may be too complex or the AI did not return valid output.' })
    }

    // Robust JSON extraction — handle markdown fences, leading text, etc.
    let jsonStr = textBlock.text.trim()
    console.log('[GrantLume] Raw response length:', jsonStr.length, 'first 200 chars:', jsonStr.substring(0, 200))

    // Strip markdown code fences
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '')
    }
    // If response starts with text before JSON, find the first {
    if (!jsonStr.startsWith('{')) {
      const jsonStart = jsonStr.indexOf('{')
      if (jsonStart >= 0) {
        jsonStr = jsonStr.substring(jsonStart)
        // Find the matching closing brace
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

    let extraction: any
    try {
      extraction = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('[GrantLume] JSON parse failed. First 500 chars:', jsonStr.substring(0, 500))
      return res.status(502).json({
        error: 'AI returned invalid JSON. The document may not contain a recognisable grant agreement structure. Try a different file or add instructions.',
        raw_preview: textBlock.text.substring(0, 300),
      })
    }

    // Validate extraction has minimal required data
    const hasProject = extraction.project?.title || extraction.project?.acronym
    const hasPartners = Array.isArray(extraction.partners) && extraction.partners.length > 0
    const hasWPs = Array.isArray(extraction.work_packages) && extraction.work_packages.length > 0

    if (!hasProject && !hasPartners && !hasWPs) {
      console.warn('[GrantLume] Extraction returned empty data:', JSON.stringify(extraction).substring(0, 500))
      return res.status(200).json({
        extraction,
        usage: claudeData.usage,
        warning: 'AI could not find meaningful project data in this document. Try uploading a grant agreement annex with budget tables, work packages, and partner information.',
      })
    }

    console.log('[GrantLume] Extraction success:',
      'project:', extraction.project?.acronym || '(no acronym)',
      'partners:', extraction.partners?.length || 0,
      'WPs:', extraction.work_packages?.length || 0,
      'deliverables:', extraction.deliverables?.length || 0,
      'milestones:', extraction.milestones?.length || 0,
    )

    return res.status(200).json({ extraction, usage: claudeData.usage })
  } catch (err) {
    console.error('[GrantLume] parse-collab-grant error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: `Server error: ${message}` })
  }
}

function buildUserPrompt(fileName: string, userInstructions?: string): string {
  let prompt = `Extract collaboration project data from this document (file: "${fileName}").`
  prompt += `\nThis is an EU-funded multi-partner project. Extract ALL project metadata, partners with their budgets, work packages with tasks, deliverables, and milestones.`
  prompt += `\nFor budget tables, look for per-partner breakdowns of: Personnel, Subcontracting, Travel & Subsistence, Equipment, and Other Goods & Services.`
  prompt += `\nReturn a JSON object matching the schema from the system prompt.`
  if (userInstructions) {
    prompt += `\n\nAdditional instructions from the user:\n${userInstructions}`
  }
  prompt += '\n\nReturn ONLY the JSON object.'
  return prompt
}
