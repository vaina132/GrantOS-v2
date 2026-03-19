import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import {
  reportTemplateService,
  getDataSource,
  executeReport,
  seedSystemTemplates,
  type ReportRow,
} from '@/services/reportTemplateService'
import type { ReportTemplate } from '@/types'
import { ReportWidget } from './ReportWidget'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import * as XLSX from 'xlsx'
import {
  Plus, Search, Eye, Pencil, Trash2, Share2, Lock,
  FileSpreadsheet, MoreHorizontal, Loader2, FolderKanban,
  Users, CalendarDays, ClipboardCheck, DollarSign, Lightbulb,
  Plane, Receipt, Activity, CalendarOff, Clock,
  BarChart3, Table2, PieChart, LineChart, Layers,
  LayoutGrid, List, Filter, LayoutDashboard, X, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, React.ElementType> = {
  FolderKanban, Users, CalendarDays, ClipboardCheck, DollarSign, Lightbulb,
  Plane, Receipt, Activity, CalendarOff,
}

const CHART_ICONS: Record<string, React.ElementType> = {
  table: Table2, bar: BarChart3, line: LineChart, pie: PieChart, stacked_bar: Layers,
}

interface SavedReportsProps {
  onNewReport: () => void
  onEditReport: (template: ReportTemplate) => void
  refreshTrigger: number
}

type Tab = 'all' | 'mine' | 'shared' | 'dashboard'
type ViewMode = 'grid' | 'list'

export function SavedReports({ onNewReport, onEditReport, refreshTrigger }: SavedReportsProps) {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [openWidgetIds, setOpenWidgetIds] = useState<Set<string>>(new Set())
  const seeded = useRef(false)

  const loadTemplates = useCallback(async () => {
    if (!orgId || !user) return
    setLoading(true)
    try {
      // Auto-seed system defaults on first load (idempotent)
      if (!seeded.current) {
        seeded.current = true
        try {
          const didSeed = await seedSystemTemplates(orgId, user.id)
          if (didSeed) toast({ title: '10 reports ready', description: 'We created starter reports for your team. Customise or create your own!' })
        } catch { /* non-fatal */ }
      }
      const data = await reportTemplateService.list(orgId)
      setTemplates(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to load saved reports', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [orgId, user])

  useEffect(() => { loadTemplates() }, [loadTemplates, refreshTrigger])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    const handler = () => setMenuOpenId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpenId])

  const filtered = templates.filter(t => {
    if (tab === 'mine' && t.created_by !== user?.id) return false
    if (tab === 'shared' && !t.is_shared) return false
    if (tab === 'dashboard' && !t.is_pinned) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || t.data_source.toLowerCase().includes(q)
    }
    return true
  })

  const handleExport = async (t: ReportTemplate, format: 'excel' | 'csv') => {
    if (!orgId) return
    setExportingId(t.id)
    try {
      const rows = await executeReport(orgId, globalYear, t.data_source, t.config)
      exportToExcel(rows, t, format)
      toast({ title: 'Exported', description: `${t.name} downloaded as ${format.toUpperCase()}.` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExportingId(null)
      setMenuOpenId(null)
    }
  }

  const handleDelete = async (t: ReportTemplate) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    setDeletingId(t.id)
    try {
      await reportTemplateService.remove(t.id)
      setTemplates(prev => prev.filter(p => p.id !== t.id))
      setOpenWidgetIds(prev => { const n = new Set(prev); n.delete(t.id); return n })
      toast({ title: 'Deleted', description: `"${t.name}" has been removed.` })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' })
    } finally {
      setDeletingId(null)
      setMenuOpenId(null)
    }
  }

  const handleToggleShare = async (t: ReportTemplate) => {
    try {
      const updated = await reportTemplateService.update(t.id, { is_shared: !t.is_shared })
      setTemplates(prev => prev.map(p => p.id === t.id ? updated : p))
      toast({ title: t.is_shared ? 'Made private' : 'Shared with org', description: `"${t.name}" is now ${t.is_shared ? 'private' : 'visible to your organisation'}.` })
    } catch {
      toast({ title: 'Error', description: 'Failed to update sharing', variant: 'destructive' })
    }
    setMenuOpenId(null)
  }

  const handleToggleDashboard = async (t: ReportTemplate) => {
    try {
      const updated = await reportTemplateService.update(t.id, { is_pinned: !t.is_pinned })
      setTemplates(prev => prev.map(p => p.id === t.id ? updated : p))
      toast({
        title: t.is_pinned ? 'Removed from Dashboard' : 'Added to Dashboard',
        description: t.is_pinned
          ? `"${t.name}" will no longer appear on your Dashboard.`
          : `"${t.name}" will now appear as a live widget on your Dashboard.`,
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' })
    }
    setMenuOpenId(null)
  }

  const handleViewInline = (id: string) => {
    setOpenWidgetIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const canManage = (t: ReportTemplate) => t.created_by === user?.id

  const myCount = templates.filter(t => t.created_by === user?.id).length
  const sharedCount = templates.filter(t => t.is_shared).length
  const dashboardCount = templates.filter(t => t.is_pinned).length

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {([
            { key: 'all' as Tab, label: 'All', count: templates.length },
            { key: 'mine' as Tab, label: 'My Reports', count: myCount },
            { key: 'shared' as Tab, label: 'Shared', count: sharedCount },
            { key: 'dashboard' as Tab, label: 'Dashboard', count: dashboardCount },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                tab === t.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.key === 'dashboard' && <LayoutDashboard className="h-3 w-3 inline mr-1 -mt-0.5" />}
              {t.label}
              <span className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-56 rounded-lg border bg-background pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={onNewReport}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Report
          </Button>
        </div>
      </div>

      {/* ── Inline open widgets ── */}
      {openWidgetIds.size > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.filter(t => openWidgetIds.has(t.id)).map(t => (
            <ReportWidget
              key={t.id}
              template={t}
              showDashboardToggle
              onToggleDashboard={handleToggleDashboard}
              onClose={() => handleViewInline(t.id)}
            />
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading reports...</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasTemplates={templates.length > 0} search={search} tab={tab} onNewReport={onNewReport} />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <ReportCard
              key={t.id}
              template={t}
              canManage={canManage(t)}
              exporting={exportingId === t.id}
              deleting={deletingId === t.id}
              menuOpen={menuOpenId === t.id}
              isViewing={openWidgetIds.has(t.id)}
              onMenuToggle={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
              onView={() => handleViewInline(t.id)}
              onEdit={() => onEditReport(t)}
              onExport={(fmt) => handleExport(t, fmt)}
              onDelete={() => handleDelete(t)}
              onToggleShare={() => handleToggleShare(t)}
              onToggleDashboard={() => handleToggleDashboard(t)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Source</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Chart</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Updated</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const ds = getDataSource(t.data_source)
                const Icon = ICONS[ds?.icon ?? ''] || FolderKanban
                const ChartIcon = CHART_ICONS[t.config.chart_type ?? 'table'] || Table2
                return (
                  <tr key={t.id} className={cn('border-b last:border-0', i % 2 === 1 && 'bg-muted/20')}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {t.is_pinned && <LayoutDashboard className="h-3 w-3 text-primary shrink-0" />}
                        {t.is_shared ? <Share2 className="h-3 w-3 text-primary shrink-0" /> : <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                        <span className="font-medium text-sm">{t.name}</span>
                      </div>
                      {t.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[250px]">{t.description}</p>}
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{ds?.label ?? t.data_source}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <ChartIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground capitalize">{t.config.chart_type ?? 'table'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{formatRelativeDate(t.updated_at)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewInline(t.id)} title={openWidgetIds.has(t.id) ? 'Close' : 'View'}>
                          {openWidgetIds.has(t.id) ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className={cn('h-7 w-7', t.is_pinned && 'text-primary')}
                          onClick={() => handleToggleDashboard(t)}
                          title={t.is_pinned ? 'Remove from Dashboard' : 'Add to Dashboard'}
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExport(t, 'excel')} title="Export Excel" disabled={exportingId === t.id}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {canManage(t) && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditReport(t)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t)} disabled={deletingId === t.id} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Report Card (grid view)
// ════════════════════════════════════════════════════════════════

function ReportCard({ template: t, canManage, exporting, deleting, menuOpen, isViewing, onMenuToggle, onView, onEdit, onExport, onDelete, onToggleShare, onToggleDashboard }: {
  template: ReportTemplate
  canManage: boolean
  exporting: boolean
  deleting: boolean
  menuOpen: boolean
  isViewing: boolean
  onMenuToggle: () => void
  onView: () => void
  onEdit: () => void
  onExport: (format: 'excel' | 'csv') => void
  onDelete: () => void
  onToggleShare: () => void
  onToggleDashboard: () => void
}) {
  const ds = getDataSource(t.data_source)
  const Icon = ICONS[ds?.icon ?? ''] || FolderKanban
  const ChartIcon = CHART_ICONS[t.config.chart_type ?? 'table'] || Table2

  const ACCENT_COLORS: Record<string, string> = {
    projects: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    staff: 'from-violet-500/10 to-violet-600/5 border-violet-500/20',
    effort: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
    timesheets: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    financials: 'from-green-500/10 to-green-600/5 border-green-500/20',
    expenses: 'from-orange-500/10 to-orange-600/5 border-orange-500/20',
    absences: 'from-rose-500/10 to-rose-600/5 border-rose-500/20',
    travel: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
    proposals: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20',
    project_health: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
  }

  const ICON_COLORS: Record<string, string> = {
    projects: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    staff: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    effort: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    timesheets: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    financials: 'bg-green-500/10 text-green-600 dark:text-green-400',
    expenses: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    absences: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    travel: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    proposals: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    project_health: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  }

  return (
    <div className={cn(
      'group relative rounded-xl border bg-gradient-to-br p-4 transition-all duration-200 hover:shadow-md',
      ACCENT_COLORS[t.data_source] || 'border-border',
      isViewing && 'ring-2 ring-primary/30',
    )}>
      {/* Top row: icon + meta */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', ICON_COLORS[t.data_source] || 'bg-muted text-muted-foreground')}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex items-center gap-1">
          <ChartIcon className="h-3 w-3 text-muted-foreground/50" />
          {t.is_pinned && <LayoutDashboard className="h-3 w-3 text-primary" />}
          {t.is_shared ? (
            <Share2 className="h-3 w-3 text-primary" />
          ) : (
            <Lock className="h-3 w-3 text-muted-foreground/30" />
          )}
          {/* Context menu */}
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); onMenuToggle() }}
              className="p-1 rounded hover:bg-background/80 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border bg-popover shadow-lg py-1"
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => onExport('excel')} disabled={exporting} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
                </button>
                <button onClick={() => onExport('csv')} disabled={exporting} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
                </button>
                <div className="my-1 border-t" />
                <button onClick={onToggleDashboard} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                  <LayoutDashboard className={cn('h-3.5 w-3.5', t.is_pinned && 'text-primary')} />
                  {t.is_pinned ? 'Remove from Dashboard' : 'Add to Dashboard'}
                </button>
                {canManage && (
                  <>
                    <button onClick={onToggleShare} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                      <Share2 className="h-3.5 w-3.5" /> {t.is_shared ? 'Make private' : 'Share with org'}
                    </button>
                    <button onClick={onEdit} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button onClick={onDelete} disabled={deleting} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name + description */}
      <h3 className="text-sm font-semibold leading-tight line-clamp-1">{t.name}</h3>
      {t.description && (
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <Filter className="h-2.5 w-2.5" />
          {t.config.columns?.length ?? 0} cols
        </span>
        {t.config.group_by && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Grouped
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {formatRelativeDate(t.updated_at)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
        <Button
          variant={isViewing ? 'secondary' : 'default'}
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={onView}
        >
          {isViewing ? <X className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
          {isViewing ? 'Close' : 'View Report'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={cn('h-7 w-7 shrink-0', t.is_pinned && 'text-primary border-primary/30')}
          onClick={onToggleDashboard}
          title={t.is_pinned ? 'Remove from Dashboard' : 'Add to Dashboard'}
        >
          <LayoutDashboard className="h-3 w-3" />
        </Button>
        {canManage && (
          <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={onEdit} title="Edit">
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Empty State
// ════════════════════════════════════════════════════════════════

function EmptyState({ hasTemplates, search, tab, onNewReport }: { hasTemplates: boolean; search: string; tab: Tab; onNewReport: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {search ? <Search className="h-7 w-7 text-muted-foreground/40" /> : tab === 'dashboard' ? <LayoutDashboard className="h-7 w-7 text-muted-foreground/40" /> : <BarChart3 className="h-7 w-7 text-muted-foreground/40" />}
      </div>
      <h3 className="text-sm font-semibold">
        {search ? 'No matching reports' : tab === 'dashboard' ? 'No dashboard reports yet' : hasTemplates ? 'No reports in this tab' : 'No saved reports yet'}
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
        {search
          ? 'Try a different search term or clear the filter.'
          : tab === 'dashboard'
          ? 'Pin reports to your Dashboard using the dashboard icon on any report card.'
          : 'Create your first custom report with the builder. Pick data, choose columns, add filters, and save it for your team.'}
      </p>
      {!search && !hasTemplates && (
        <Button size="sm" className="mt-4" onClick={onNewReport}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Report
        </Button>
      )}
    </div>
  )
}

// ── Helpers ──

function exportToExcel(rows: ReportRow[], t: ReportTemplate, format: 'excel' | 'csv' = 'excel') {
  const ds = getDataSource(t.data_source)
  const cols = ds?.columns.filter(c => t.config.columns.includes(c.key)) ?? []
  const headers = cols.map(c => c.label)
  const dataRows = rows.map(row => cols.map(c => {
    const v = row[c.key]
    if (v === null || v === undefined) return ''
    if (c.type === 'number' || c.type === 'currency' || c.type === 'percent') return Number(v)
    return String(v)
  }))
  const wsData = [headers, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, t.name.slice(0, 31))
  const ext = format === 'csv' ? 'csv' : 'xlsx'
  XLSX.writeFile(wb, `${t.name.replace(/\s+/g, '_')}.${ext}`, format === 'csv' ? { bookType: 'csv' } : undefined)
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d ago`
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  } catch {
    return dateStr
  }
}
