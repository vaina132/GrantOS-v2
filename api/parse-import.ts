import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Serverless API endpoint: /api/parse-import
 *
 * Accepts an uploaded file (via Supabase Storage path) and uses Claude AI to
 * extract structured data (persons, projects, or proposals) from unstructured
 * documents like PDFs, images, or Word files.
 *
 * For CSV/Excel files, extraction happens client-side — this endpoint is only
 * called for files that need AI interpretation.
 */

const SYSTEM_PROMPT = `You are an expert data extraction assistant for a grant & project management platform called GrantLume. You will receive a document (text or image) from which you need to extract structured data.

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
{ "rows": [{ "title": "string", "acronym": "string|null", "call_identifier": "string|null", "funding_programme": "string|null", "topic": "string|null", "status": "string|null", "submission_date": "YYYY-MM-DD|null", "requested_budget": "number|null", "duration_months": "number|null", "abstract": "string|null", "confidence": 85, "_notes": "string" }] }

Return ONLY the JSON object. No markdown fences, no explanation.`

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

    const { storage_path, file_name, import_type, user_instructions } = req.body || {}

    if (!storage_path) return res.status(400).json({ error: 'No storage_path provided' })
    if (!import_type || !['persons', 'projects', 'proposals'].includes(import_type)) {
      return res.status(400).json({ error: 'import_type must be one of: persons, projects, proposals' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('grant-uploads')
      .download(storage_path)

    if (downloadError || !fileData) {
      return res.status(400).json({ error: `Failed to download file: ${downloadError?.message || 'Not found'}` })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const ext = (file_name || storage_path).toLowerCase().split('.').pop() || ''

    // Build the Claude message content based on file type
    let messageContent: any[]

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      // Image files — send as base64 vision input
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
          text: buildUserPrompt(import_type, file_name, user_instructions),
        },
      ]
    } else if (ext === 'pdf') {
      // PDF — extract text with unpdf
      const { extractText } = await import('unpdf')
      const { text: pdfPages } = await extractText(new Uint8Array(arrayBuffer))
      const pdfText = pdfPages.join('\n')

      if (!pdfText || pdfText.trim().length < 20) {
        return res.status(400).json({
          error: 'Could not extract text from PDF. The file may be scanned/image-based. Try uploading as an image instead.',
        })
      }

      // Truncate to stay within context window
      const maxChars = 100000
      const truncatedText = pdfText.length > maxChars
        ? pdfText.slice(0, maxChars) + '\n\n[Document truncated]'
        : pdfText

      messageContent = [{
        type: 'text',
        text: buildUserPrompt(import_type, file_name, user_instructions) +
          `\n\n--- DOCUMENT TEXT ---\n${truncatedText}\n--- END ---`,
      }]
    } else {
      // Word, text, etc. — try to read as text
      const textContent = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer))

      if (!textContent || textContent.trim().length < 10) {
        return res.status(400).json({
          error: 'Could not read file contents. Please try a different format (CSV, Excel, PDF, or image).',
        })
      }

      const maxChars = 100000
      const truncatedText = textContent.length > maxChars
        ? textContent.slice(0, maxChars) + '\n\n[Document truncated]'
        : textContent

      messageContent = [{
        type: 'text',
        text: buildUserPrompt(import_type, file_name, user_instructions) +
          `\n\n--- DOCUMENT TEXT ---\n${truncatedText}\n--- END ---`,
      }]
    }

    // Call Claude
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
    const textBlock = claudeData.content?.find((b: any) => b.type === 'text')
    if (!textBlock?.text) {
      return res.status(502).json({ error: 'No response from AI' })
    }

    // Parse JSON response
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const extraction = JSON.parse(jsonStr)

    return res.status(200).json({ extraction, usage: claudeData.usage })
  } catch (err) {
    console.error('[GrantLume] parse-import error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: `Server error: ${message}` })
  }
}

function buildUserPrompt(importType: string, fileName: string, userInstructions?: string): string {
  let prompt = `Extract "${importType}" data from this document (file: "${fileName}").`
  prompt += `\nReturn a JSON object with a "rows" array matching the "${importType}" schema from the system prompt.`
  prompt += `\nBe thorough — extract every record you can find.`
  if (userInstructions) {
    prompt += `\n\nAdditional instructions from the user:\n${userInstructions}`
  }
  prompt += '\n\nReturn ONLY the JSON object.'
  return prompt
}
