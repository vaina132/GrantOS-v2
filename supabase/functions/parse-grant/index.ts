import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
    if (!claudeApiKey) {
      return new Response(
        JSON.stringify({ error: 'CLAUDE_API_KEY not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const organisationAbbreviation = (formData.get('organisation_abbreviation') as string | null) ?? ''
    const userInstructions = (formData.get('user_instructions') as string | null) ?? ''

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Determine media type
    let mediaType = 'application/pdf'
    const name = file.name.toLowerCase()
    if (name.endsWith('.png')) mediaType = 'image/png'
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mediaType = 'image/jpeg'
    else if (name.endsWith('.webp')) mediaType = 'image/webp'
    else if (name.endsWith('.gif')) mediaType = 'image/gif'

    // Build user prompt with optional context
    let userPrompt = 'Please parse this grant agreement document and extract all project information as the JSON schema described in the system prompt.'
    if (organisationAbbreviation) {
      userPrompt += `\n\nIMPORTANT: Our organisation\'s abbreviation/name is "${organisationAbbreviation}". When extracting budget figures, PM rates, and personnel costs, focus on the data specific to this organisation (not the total consortium figures). Look for budget tables or annexes that break down costs per beneficiary/partner.`
    }
    if (userInstructions) {
      userPrompt += `\n\nAdditional instructions from the user:\n${userInstructions}`
    }
    userPrompt += '\n\nReturn ONLY the JSON object.'

    // Build Claude API request
    const isPdf = mediaType === 'application/pdf'

    const content: any[] = isPdf
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ]
      : [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ]

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      console.error('Claude API error:', claudeResponse.status, errBody)
      return new Response(
        JSON.stringify({ error: `Claude API error: ${claudeResponse.status}`, details: errBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const claudeData = await claudeResponse.json()

    // Extract the text content from Claude's response
    const textBlock = claudeData.content?.find((b: any) => b.type === 'text')
    if (!textBlock?.text) {
      return new Response(
        JSON.stringify({ error: 'No text response from Claude' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse the JSON from Claude's response (handle possible markdown code fences)
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const extraction = JSON.parse(jsonStr)

    return new Response(
      JSON.stringify({ extraction, usage: claudeData.usage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('parse-grant error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
