import { useState, useEffect, useCallback } from 'react'
import { auditService, type AuditEntry, type AuditFilters } from '@/services/auditService'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/common/SkeletonTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

export function AuditLogViewer() {
  const { orgId } = useAuthStore()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

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

      const data = await auditService.list(orgId, filters)
      setEntries(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit log'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId, page, entityFilter, actionFilter])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const entityTypes = ['person', 'project', 'assignment', 'timesheet', 'absence', 'budget', 'settings']
  const actions = ['create', 'update', 'delete', 'approve', 'reject', 'lock', 'unlock']

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Track all changes made in the system" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-wrap">
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(0) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All entities</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
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
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable columns={5} rows={10} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No audit entries"
          description="Audit log entries will appear here as changes are made in the system."
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
                    <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {entry.user_email ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        {entry.entity_type && (
                          <Badge variant="secondary" className="text-xs">{entry.entity_type}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {entry.action && (
                          <Badge
                            variant={entry.action === 'delete' ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {entry.action}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                        {entry.details ?? '—'}
                      </td>
                    </tr>
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
