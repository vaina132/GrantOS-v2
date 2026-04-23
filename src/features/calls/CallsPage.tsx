import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star, ExternalLink, Search, Loader2, Rocket, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  euCallsService,
  type EuCallTopic,
  type WatchlistEntry,
} from '@/services/euCallsService'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['', 'Forthcoming', 'Open', 'Closed']

export function CallsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { orgId, user } = useAuthStore()

  const [topics, setTopics] = useState<EuCallTopic[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [programme, setProgramme] = useState('')
  const [status, setStatus] = useState('')
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [tab, setTab] = useState<'browse' | 'watchlist'>('browse')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const starredIds = useMemo(
    () => new Set(watchlist.map(w => w.topic_identifier)),
    [watchlist],
  )

  const loadCalls = async (opts?: { showSpinner?: boolean }) => {
    if (opts?.showSpinner === false) setRefreshing(true)
    else setLoading(true)
    try {
      const resp = await euCallsService.listTopics({
        q: query || undefined,
        programme: programme || undefined,
        status: status || undefined,
        pageNumber: page,
        pageSize,
      })
      setTopics(resp.topics)
      setTotal(resp.total)
    } catch (err) {
      toast({
        title: 'Failed to load calls',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadWatchlist = async () => {
    if (!orgId) return
    try {
      const list = await euCallsService.listWatchlist(orgId)
      setWatchlist(list)
    } catch (err) {
      toast({
        title: 'Failed to load watchlist',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    void loadCalls()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    void loadWatchlist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const runSearch = () => {
    setPage(1)
    void loadCalls()
  }

  const toggleStar = async (topic: EuCallTopic) => {
    if (!orgId) return
    try {
      if (starredIds.has(topic.identifier)) {
        await euCallsService.unstar(orgId, topic.identifier)
        setWatchlist(prev => prev.filter(w => w.topic_identifier !== topic.identifier))
      } else {
        const entry = await euCallsService.star(orgId, topic, user?.id ?? null)
        setWatchlist(prev => [entry, ...prev])
      }
    } catch (err) {
      toast({
        title: 'Failed to update watchlist',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const startProposalFromTopic = (topicIdentifier: string, title: string) => {
    const qs = new URLSearchParams({
      call: topicIdentifier,
      name: title,
    })
    navigate(`/proposals?${qs.toString()}`)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const renderTopicRow = (topic: EuCallTopic, starredOnly = false) => {
    const starred = starredIds.has(topic.identifier)
    return (
      <tr key={topic.identifier} className="border-b last:border-0 hover:bg-muted/20">
        <td className="px-3 py-2 w-10">
          <button onClick={() => toggleStar(topic)} title={starred ? 'Unstar' : 'Star'}>
            <Star
              className={cn(
                'h-4 w-4 transition',
                starred
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-muted-foreground hover:text-amber-500',
              )}
            />
          </button>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-primary">
          {topic.url ? (
            <a
              href={topic.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline inline-flex items-center gap-1"
            >
              {topic.identifier}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            topic.identifier
          )}
        </td>
        <td className="px-3 py-2 max-w-md">
          <div className="text-sm font-medium truncate" title={topic.title}>{topic.title}</div>
          {topic.destination && (
            <div className="text-xs text-muted-foreground truncate">{topic.destination}</div>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {topic.programme || '—'}
        </td>
        <td className="px-3 py-2">
          {topic.status ? (
            <Badge variant="outline" className="text-[10px]">{topic.status}</Badge>
          ) : (
            '—'
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {topic.deadlineDate || '—'}
        </td>
        <td className="px-3 py-2 text-right">
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => startProposalFromTopic(topic.identifier, topic.title)}
            title="Start a proposal from this call"
          >
            <Rocket className="h-3.5 w-3.5 mr-1" />
            {starredOnly ? 'Start proposal' : 'Start'}
          </Button>
        </td>
      </tr>
    )
  }

  const watchlistTopics: EuCallTopic[] = useMemo(
    () =>
      watchlist.map(w => ({
        identifier: w.topic_identifier,
        title: w.title ?? w.topic_identifier,
        callIdentifier: w.call_identifier ?? '',
        programme: w.programme ?? '',
        destination: '',
        status: w.status ?? '',
        deadlineDate: w.deadline_date ?? undefined,
        keywords: [],
        url: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${w.topic_identifier}`,
      })),
    [watchlist],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.calls', { defaultValue: 'Funding calls' })}
        description="Browse upcoming and open EU Funding & Tenders topics. Star the ones you care about and launch a proposal in one click."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadCalls({ showSpinner: false })}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('browse')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            tab === 'browse'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Browse
        </button>
        <button
          onClick={() => setTab('watchlist')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            tab === 'watchlist'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Watchlist
          {watchlist.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{watchlist.length}</Badge>
          )}
        </button>
      </div>

      {tab === 'browse' && (
        <>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by keyword, topic ID, call ID…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSearch()}
                    className="pl-9"
                  />
                </div>
                <Input
                  placeholder="Programme (e.g. HORIZON)"
                  value={programme}
                  onChange={e => setProgramme(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                />
                <select
                  value={status}
                  onChange={e => {
                    setStatus(e.target.value)
                    setPage(1)
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>
                      {s || 'Any status'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={runSearch}>
                  <Search className="h-4 w-4 mr-1" /> Search
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Results
                {!loading && (
                  <Badge variant="secondary" className="text-[10px]">
                    {total} topic{total === 1 ? '' : 's'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : topics.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No topics match the current filters.
                </div>
              ) : (
                <>
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium w-10"></th>
                          <th className="px-3 py-2 text-left font-medium">Topic ID</th>
                          <th className="px-3 py-2 text-left font-medium">Title</th>
                          <th className="px-3 py-2 text-left font-medium">Programme</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                          <th className="px-3 py-2 text-left font-medium">Deadline</th>
                          <th className="px-3 py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topics.map(t => renderTopicRow(t))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>
                        Page {page} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'watchlist' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Your watchlist
              <Badge variant="secondary" className="text-[10px]">{watchlist.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {watchlist.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No starred calls yet. Click the <Star className="inline h-3 w-3" /> icon on any
                topic in the Browse tab to add it here.
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium w-10"></th>
                      <th className="px-3 py-2 text-left font-medium">Topic ID</th>
                      <th className="px-3 py-2 text-left font-medium">Title</th>
                      <th className="px-3 py-2 text-left font-medium">Programme</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Deadline</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistTopics.map(t => renderTopicRow(t, true))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {refreshing && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-md bg-background border shadow px-3 py-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Refreshing…
        </div>
      )}
    </div>
  )
}
