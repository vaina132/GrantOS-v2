import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/apiClient'

// Not in the generated database.types.ts yet.
const sb = supabase as any

export interface EuCallTopic {
  identifier: string
  title: string
  callIdentifier: string
  callTitle?: string
  programme: string
  programmeId?: string
  programmePeriod?: string
  typeOfAction?: string
  status: string
  statusLabel: string
  openingDate?: string
  deadlineDate?: string
  deadlineModel?: string
  summary?: string
  keywords: string[]
  url?: string
}

export interface EuCallListResponse {
  topics: EuCallTopic[]
  total: number
  pageSize: number
  pageNumber: number
  source?: string
}

export interface WatchlistEntry {
  id: string
  org_id: string
  topic_identifier: string
  title: string | null
  programme: string | null
  call_identifier: string | null
  deadline_date: string | null
  status: string | null
  notes: string | null
  starred_at: string
}

export interface EuCallListParams {
  q?: string
  programme?: string
  status?: string
  pageNumber?: number
  pageSize?: number
}

export const euCallsService = {
  async listTopics(params: EuCallListParams = {}): Promise<EuCallListResponse> {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.programme) qs.set('programme', params.programme)
    if (params.status) qs.set('status', params.status)
    qs.set('pageNumber', String(params.pageNumber ?? 1))
    qs.set('pageSize', String(params.pageSize ?? 100))

    const res = await apiFetch(`/api/ai?action=eu-calls-list&${qs.toString()}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Failed to load calls (${res.status})`)
    }
    return (await res.json()) as EuCallListResponse
  },

  async listWatchlist(orgId: string): Promise<WatchlistEntry[]> {
    const { data, error } = await sb
      .from('eu_call_watchlist')
      .select('*')
      .eq('org_id', orgId)
      .order('starred_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as any[]).map(rowToWatchlist)
  },

  async star(
    orgId: string,
    topic: EuCallTopic,
    userId: string | null,
    notes?: string,
  ): Promise<WatchlistEntry> {
    const { data, error } = await sb
      .from('eu_call_watchlist')
      .upsert(
        {
          org_id: orgId,
          topic_identifier: topic.identifier,
          title: topic.title,
          programme: topic.programme || null,
          call_identifier: topic.callIdentifier || null,
          deadline_date: topic.deadlineDate || null,
          status: topic.status || null,
          notes: notes ?? null,
          starred_by: userId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,topic_identifier' },
      )
      .select()
      .single()
    if (error) throw error
    return rowToWatchlist(data)
  },

  async unstar(orgId: string, topicIdentifier: string): Promise<void> {
    const { error } = await sb
      .from('eu_call_watchlist')
      .delete()
      .eq('org_id', orgId)
      .eq('topic_identifier', topicIdentifier)
    if (error) throw error
  },

  async updateNotes(
    orgId: string,
    topicIdentifier: string,
    notes: string,
  ): Promise<void> {
    const { error } = await sb
      .from('eu_call_watchlist')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('topic_identifier', topicIdentifier)
    if (error) throw error
  },
}

function rowToWatchlist(r: any): WatchlistEntry {
  return {
    id: r.id,
    org_id: r.org_id,
    topic_identifier: r.topic_identifier,
    title: r.title ?? null,
    programme: r.programme ?? null,
    call_identifier: r.call_identifier ?? null,
    deadline_date: r.deadline_date ?? null,
    status: r.status ?? null,
    notes: r.notes ?? null,
    starred_at: r.starred_at,
  }
}
