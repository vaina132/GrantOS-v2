import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { auditService, type AuditEntry, type AuditChange, type AuditFilters } from '@/services/auditService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Shield, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download, Search, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  approve: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  reject: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  lock: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  unlock: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  login: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  logout: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  export: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
}

function ExpandableRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [changes, setChanges] = useState<AuditChange[]>([])
  const [loadingChanges, setLoadingChanges] = useState(false)

  const toggleExpand = async () => {
    if (expanded) { setExpanded(false); return }
    if (entry.entity_type && entry.entity_id && entry.action === 'update') {
      setLoadingChanges(true)
      const data = await auditService.getChanges(entry.entity_type, entry.entity_id)
      setChanges(data)
      setLoadingChanges(false)
    }
    setExpanded(true)
  }

  const hasChanges = entry.action === 'update' && entry.entity_id

  return (
    <>
      <tr
        className={cn('border-b last:border-0 hover:bg-muted/20', hasChanges && 'cursor-pointer')}
        onClick={hasChanges ? toggleExpand : undefined}
      >
        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(entry.created_at).toLocaleString()}
        </td>
        <td className="px-4 py-2 text-xs">
          {entry.user_email ?? '—'}
        </td>
        <td className="px-4 py-2">
          {entry.entity_type && (
            <Badge variant="secondary" className="text-xs capitalize">{entry.entity_type}</Badge>
          )}
        </td>
        <td className="px-4 py-2">
          {entry.action && (
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-700')}>
              {entry.action}
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-xs text-muted-foreground max-w-[400px]">
          <div className="flex items-center gap-1">
            <span className="truncate">{entry.details ?? '—'}</span>
            {hasChanges && (
              expanded
                ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={5} className="px-6 py-3">
            {loadingChanges ? (
              <div className="text-xs text-muted-foreground">Loading changes…</div>
            ) : changes.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No field-level changes recorded for this entry.</div>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground mb-2">Field Changes</div>
                <div className="rounded border bg-background overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-1.5 text-left font-medium w-[180px]">Field</th>
                        <th className="px-3 py-1.5 text-left font-medium">Before</th>
                        <th className="px-3 py-1.5 w-6" />
                        <th className="px-3 py-1.5 text-left font-medium">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-medium text-foreground">{c.field_name}</td>
                          <td className="px-3 py-1.5 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/10">
                            {c.old_value ?? <span className="italic text-muted-foreground">empty</span>}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </td>
                          <td className="px-3 py-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10">
                            {c.new_value ?? <span className="italic text-muted-foreground">empty</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function AuditLogViewer() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const loadEntries = useCallback(async () => {
    if (!orgId) {
      setEntries([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const filters: AuditFilters = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }
      if (entityFilter) filters.entity_type = entityFilter
      if (actionFilter) filters.action = actionFilter
      if (userFilter) filters.user_email = userFilter
      if (searchQuery) filters.search = searchQuery
      if (dateFrom) filters.date_from = dateFrom
      if (dateTo) filters.date_to = dateTo

      const data = await auditService.list(orgId, filters)
      setEntries(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit log'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, page, entityFilter, actionFilter, userFilter, searchQuery, dateFrom, dateTo])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const entityTypes = ['person', 'project', 'assignment', 'timesheet', 'absence', 'budget', 'settings', 'security']
  const actions = ['create', 'update', 'delete', 'approve', 'reject', 'lock', 'unlock', 'login', 'logout', 'export']

  const hasActiveFilters = !!(entityFilter || actionFilter || userFilter || searchQuery || dateFrom || dateTo)

  const clearFilters = () => {
    setEntityFilter('')
    setActionFilter('')
    setUserFilter('')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }

  const exportCSV = () => {
    if (entries.length === 0) return
    const headers = ['Timestamp', 'User', 'Entity', 'Action', 'Entity ID', 'Details']
    const rows = entries.map((e) => [
      new Date(e.created_at).toISOString(),
      e.user_email ?? '',
      e.entity_type ?? '',
      e.action ?? '',
      e.entity_id ?? '',
      (e.details ?? '').replace(/"/g, '""'),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: t('common.exported'), description: `${entries.length} entries exported to CSV.` })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('audit.title')}
        description="Track all changes made in the system"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={entries.length === 0} className="gap-1.5">
              <Download className="h-4 w-4" />
              {t('common.export')} CSV
            </Button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2 flex-wrap flex-1">
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(0) }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All entities</option>
              {entityTypes.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(0) }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="gap-1 text-xs"
            >
              <Search className="h-3.5 w-3.5" />
              {showFilters ? 'Less filters' : 'More filters'}
            </Button>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">User email</label>
              <Input
                placeholder="Search by email…"
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setPage(0) }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search details</label>
              <Input
                placeholder="Search in details…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable columns={5} rows={10} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No audit entries"
          description={hasActiveFilters ? 'No entries match the current filters. Try adjusting your criteria.' : 'Audit log entries will appear here as changes are made in the system.'}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Timestamp</th>
                    <th className="px-4 py-2 text-left font-medium">User</th>
                    <th className="px-4 py-2 text-left font-medium">Entity</th>
                    <th className="px-4 py-2 text-left font-medium">Action</th>
                    <th className="px-4 py-2 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <ExpandableRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} · Showing {entries.length} entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={entries.length < PAGE_SIZE}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
