import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Proxy endpoint to search EU Funding & Tenders Portal for open calls/topics.
 * The EC portal's frontend uses an internal search API that we proxy here
 * to avoid CORS issues from the browser.
 *
 * GET /api/eu-calls?q=HORIZON-CL4&pageSize=20
 */

interface EuTopic {
  identifier: string
  title: string
  callIdentifier?: string
  deadlineDate?: string
  status?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const query = (req.query.q as string) ?? ''
  const pageSize = parseInt((req.query.pageSize as string) ?? '20', 10)

  if (query.length < 2) {
    return res.status(200).json({ topics: [] })
  }

  try {
    // The EC Funding & Tenders Portal uses this Search API endpoint
    const searchUrl = new URL(
      'https://api.tech.ec.europa.eu/search-api/prod/rest/search'
    )
    searchUrl.searchParams.set('apiKey', 'SEDIA')
    searchUrl.searchParams.set('text', query)
    searchUrl.searchParams.set('pageSize', String(pageSize))
    searchUrl.searchParams.set('pageNumber', '1')
    // type=1 = calls/topics
    searchUrl.searchParams.set('type', '1')

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GrantOS/1.0',
      },
    })

    if (!response.ok) {
      // Fallback: try the topic-list endpoint
      return await fallbackSearch(query, pageSize, res)
    }

    const data = await response.json()

    // Parse results from the EC Search API response
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
    // If the primary API fails, try the fallback
    return await fallbackSearch(query, pageSize, res)
  }
}

async function fallbackSearch(
  query: string,
  pageSize: number,
  res: VercelResponse,
) {
  try {
    // Fallback: try the portal's topic list data file
    const listUrl =
      'https://ec.europa.eu/info/funding-tenders/opportunities/data/topic-list.json'

    const response = await fetch(listUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GrantOS/1.0',
      },
    })

    if (!response.ok) {
      return res.status(200).json({ topics: [], source: 'none' })
    }

    const data = await response.json()
    const all: any[] = data.topicData?.Topics ?? data ?? []

    const q = query.toLowerCase()
    const filtered = all
      .filter(
        (t: any) =>
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
