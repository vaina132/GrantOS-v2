import { useState, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useDraftKeeper } from '@/lib/draftKeeper'
import { DraftSavePill, DraftRestoreBanner } from '@/components/draft'
import {
  DATA_SOURCES,
  getDataSource,
  getDefaultColumns,
  executeReport,
  reportTemplateService,
  type ReportRow,
  type DataSourceDef,
  type ColumnDef,
} from '@/services/reportTemplateService'
import type { ReportDataSource, ReportConfig, ReportChartType, ReportTemplate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import * as XLSX from 'xlsx'
import {
  FolderKanban, Users, CalendarDays, ClipboardCheck, DollarSign, Lightbulb,
  Plane, Receipt, Activity, ArrowLeft, ArrowRight, Play, Save, Share2,
  Table2, BarChart3, LineChart, PieChart, Layers,
  GripVertical, X, Check, ChevronDown, Loader2, FileSpreadsheet, FileText,
  CalendarOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Icon map ──
const ICONS: Record<string, React.ElementType> = {
  FolderKanban, Users, CalendarDays, ClipboardCheck, DollarSign, Lightbulb,
  Plane, Receipt, Activity, CalendarOff,
}

// ── Chart type options ──
const CHART_OPTIONS: { key: ReportChartType; label: string; icon: React.ElementType }[] = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'bar', label: 'Bar', icon: BarChart3 },
  { key: 'stacked_bar', label: 'Stacked', icon: Layers },
  { key: 'line', label: 'Line', icon: LineChart },
  { key: 'pie', label: 'Pie', icon: PieChart },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── Props ──
interface ReportBuilderProps {
  /** If editing an existing template */
  editTemplate?: ReportTemplate | null
  onClose: () => void
  onSaved: () => void
}

type BuilderStep = 'source' | 'columns' | 'filters' | 'visualise' | 'preview'

/**
 * Everything the user has configured in the wizard. `step` is persisted
 * so reload rehydrates to the same screen the user was on. Preview /
 * export state is transient and not persisted.
 */
type ReportBuilderDraft = {
  step: BuilderStep
  source: ReportDataSource | null
  selectedColumns: string[]
  filters: Record<string, unknown>
  groupBy: string | null
  sortField: string | null
  sortDir: 'asc' | 'desc'
  chartType: ReportChartType
  reportName: string
  reportDesc: string
  isShared: boolean
}

const STEPS: { key: BuilderStep; label: string }[] = [
  { key: 'source', label: 'Data Source' },
  { key: 'columns', label: 'Columns' },
  { key: 'filters', label: 'Filters & Grouping' },
  { key: 'visualise', label: 'Visualisation' },
  { key: 'preview', label: 'Preview & Save' },
]

export function ReportBuilder({ editTemplate, onClose, onSaved }: ReportBuilderProps) {
  const { orgId, user } = useAuthStore()
  const { globalYear } = useUiStore()

  // ── Builder state ──
  const [step, setStep] = useState<BuilderStep>(editTemplate ? 'columns' : 'source')
  const [source, setSource] = useState<ReportDataSource | null>(editTemplate?.data_source ?? null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(editTemplate?.config.columns ?? [])
  const [filters, setFilters] = useState<Record<string, unknown>>(editTemplate?.config.filters ?? {})
  const [groupBy, setGroupBy] = useState<string | null>(editTemplate?.config.group_by ?? null)
  const [sortField, setSortField] = useState<string | null>(editTemplate?.config.sort_by?.field ?? null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(editTemplate?.config.sort_by?.direction ?? 'asc')
  const [chartType, setChartType] = useState<ReportChartType>(editTemplate?.config.chart_type ?? 'table')

  // ── Save state ──
  const [reportName, setReportName] = useState(editTemplate?.name ?? '')
  const [reportDesc, setReportDesc] = useState(editTemplate?.description ?? '')
  const [isShared, setIsShared] = useState(editTemplate?.is_shared ?? false)
  const [saving, setSaving] = useState(false)

  // ── Preview state ──
  const [previewData, setPreviewData] = useState<ReportRow[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const sourceDef = useMemo(() => source ? getDataSource(source) : null, [source])

  // DraftKeeper: persists the entire wizard state so a reload in the
  // middle of configuring a report never forces the user to start over.
  // Baseline is the initial values derived from editTemplate (or the
  // brand-new empty state) — edits diverge, draft catches.
  const baseline = useMemo<ReportBuilderDraft>(() => ({
    step: editTemplate ? 'columns' : 'source',
    source: editTemplate?.data_source ?? null,
    selectedColumns: editTemplate?.config.columns ?? [],
    filters: editTemplate?.config.filters ?? {},
    groupBy: editTemplate?.config.group_by ?? null,
    sortField: editTemplate?.config.sort_by?.field ?? null,
    sortDir: editTemplate?.config.sort_by?.direction ?? 'asc',
    chartType: editTemplate?.config.chart_type ?? 'table',
    reportName: editTemplate?.name ?? '',
    reportDesc: editTemplate?.description ?? '',
    isShared: editTemplate?.is_shared ?? false,
  }), [editTemplate])

  const draftValue = useMemo<ReportBuilderDraft>(
    () => ({
      step, source, selectedColumns, filters, groupBy, sortField, sortDir,
      chartType, reportName, reportDesc, isShared,
    }),
    [step, source, selectedColumns, filters, groupBy, sortField, sortDir, chartType, reportName, reportDesc, isShared],
  )

  const draft = useDraftKeeper<ReportBuilderDraft>({
    key: {
      orgId: orgId ?? '_no-org',
      userId: user?.id ?? '_anon',
      formKey: 'report-builder',
      recordId: editTemplate?.id ?? 'new',
    },
    value: draftValue,
    setValue: (next) => {
      setStep(next.step)
      setSource(next.source)
      setSelectedColumns(next.selectedColumns)
      setFilters(next.filters)
      setGroupBy(next.groupBy)
      setSortField(next.sortField)
      setSortDir(next.sortDir)
      setChartType(next.chartType)
      setReportName(next.reportName)
      setReportDesc(next.reportDesc)
      setIsShared(next.isShared)
    },
    enabled: !!orgId && !!user,
    schemaVersion: 1,
    baseline,
    silentRestoreWindowMs: 0,
  })

  const currentStepIdx = STEPS.findIndex(s => s.key === step)
  const canGoNext = (() => {
    switch (step) {
      case 'source': return !!source
      case 'columns': return selectedColumns.length > 0
      case 'filters': return true
      case 'visualise': return true
      case 'preview': return reportName.trim().length > 0
    }
  })()

  const goNext = () => {
    const nextIdx = currentStepIdx + 1
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx].key)
  }
  const goBack = () => {
    const prevIdx = currentStepIdx - 1
    if (prevIdx >= 0) setStep(STEPS[prevIdx].key)
  }

  // ── When entering preview, auto-run ──
  const runPreview = useCallback(async () => {
    if (!orgId || !source) return
    setPreviewLoading(true)
    setPreviewData(null)
    try {
      const config: ReportConfig = {
        columns: selectedColumns,
        filters,
        group_by: groupBy,
        sort_by: sortField ? { field: sortField, direction: sortDir } : null,
        chart_type: chartType,
      }
      const rows = await executeReport(orgId, globalYear, source, config)
      setPreviewData(rows)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load data', variant: 'destructive' })
    } finally {
      setPreviewLoading(false)
    }
  }, [orgId, source, selectedColumns, filters, groupBy, sortField, sortDir, chartType, globalYear])

  const handleStepChange = (newStep: BuilderStep) => {
    setStep(newStep)
    if (newStep === 'preview') runPreview()
  }

  // ── Save template ──
  const handleSave = async () => {
    if (!orgId || !source || !user) return
    setSaving(true)
    try {
      const config: ReportConfig = {
        columns: selectedColumns,
        filters,
        group_by: groupBy,
        sort_by: sortField ? { field: sortField, direction: sortDir } : null,
        chart_type: chartType,
      }
      if (editTemplate) {
        await reportTemplateService.update(editTemplate.id, {
          name: reportName.trim(),
          description: reportDesc.trim() || null,
          data_source: source,
          config,
          is_shared: isShared,
        })
        toast({ title: 'Report updated', description: `"${reportName}" saved successfully.` })
      } else {
        await reportTemplateService.create({
          org_id: orgId,
          name: reportName.trim(),
          description: reportDesc.trim() || undefined,
          data_source: source,
          config,
          is_shared: isShared,
          created_by: user.id,
          created_by_name: user.email ?? '',
        })
        toast({ title: 'Report saved', description: `"${reportName}" is now available in your reports.` })
      }
      draft.discard()
      onSaved()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Export ──
  const handleExport = async (format: 'excel' | 'csv') => {
    if (!previewData || previewData.length === 0) return
    setExporting(true)
    try {
      const cols = sourceDef?.columns.filter(c => selectedColumns.includes(c.key)) ?? []
      const headers = cols.map(c => c.label)
      const rows = previewData.map(row => cols.map(c => formatCellValue(row[c.key], c)))
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, reportName || 'Report')
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      XLSX.writeFile(wb, `${(reportName || 'report').replace(/\s+/g, '_')}.${ext}`, format === 'csv' ? { bookType: 'csv' } : undefined)
      toast({ title: 'Exported', description: `Report downloaded as ${ext.toUpperCase()}.` })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // ── Source selection (when entering source step) ──
  const handleSourceSelect = (ds: ReportDataSource) => {
    setSource(ds)
    setSelectedColumns(getDefaultColumns(ds))
    setFilters({})
    setGroupBy(null)
    setSortField(null)
    setPreviewData(null)
  }

  // ── Column toggle ──
  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    )
  }

  // ── Render ──
  return (
    <div className="space-y-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editTemplate ? 'Edit Report' : 'New Report'}</h2>
            {source && sourceDef && (
              <p className="text-xs text-muted-foreground mt-0.5">{sourceDef.label} — {sourceDef.description}</p>
            )}
          </div>
        </div>
        <DraftSavePill status={draft.status} lastSavedAt={draft.lastSavedAt} />
      </div>

      {draft.hasDraft && (
        <DraftRestoreBanner
          ageMs={draft.draftAge}
          onRestore={draft.restore}
          onDiscard={draft.discard}
          className="mb-4"
        />
      )}

      {/* ── Step indicator ── */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => {
          const isCurrent = s.key === step
          const isPast = i < currentStepIdx
          const isClickable = isPast || (i === currentStepIdx + 1 && canGoNext)
          return (
            <button
              key={s.key}
              onClick={() => {
                if (isClickable || isCurrent) handleStepChange(s.key)
              }}
              disabled={!isClickable && !isCurrent && !isPast}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                isCurrent && 'bg-primary text-primary-foreground shadow-sm',
                isPast && 'bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer',
                !isCurrent && !isPast && isClickable && 'text-muted-foreground hover:bg-muted cursor-pointer',
                !isCurrent && !isPast && !isClickable && 'text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              <span className={cn(
                'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                isCurrent && 'bg-primary-foreground/20 text-primary-foreground',
                isPast && 'bg-primary text-primary-foreground',
                !isCurrent && !isPast && 'bg-muted-foreground/10 text-muted-foreground',
              )}>
                {isPast ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Step content ── */}
      <div className="min-h-[400px]">
        {step === 'source' && (
          <StepSource
            selected={source}
            onSelect={handleSourceSelect}
          />
        )}
        {step === 'columns' && sourceDef && (
          <StepColumns
            sourceDef={sourceDef}
            selected={selectedColumns}
            onToggle={toggleColumn}
            onReorder={setSelectedColumns}
          />
        )}
        {step === 'filters' && sourceDef && (
          <StepFilters
            sourceDef={sourceDef}
            filters={filters}
            onFiltersChange={setFilters}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortField={sortField}
            sortDir={sortDir}
            onSortFieldChange={setSortField}
            onSortDirChange={setSortDir}
            selectedColumns={selectedColumns}
          />
        )}
        {step === 'visualise' && (
          <StepVisualise
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
        )}
        {step === 'preview' && sourceDef && (
          <StepPreview
            sourceDef={sourceDef}
            selectedColumns={selectedColumns}
            data={previewData}
            loading={previewLoading}
            chartType={chartType}
            groupBy={groupBy}
            reportName={reportName}
            reportDesc={reportDesc}
            isShared={isShared}
            onReportNameChange={setReportName}
            onReportDescChange={setReportDesc}
            onIsSharedChange={setIsShared}
            onRefresh={runPreview}
            onExport={handleExport}
            exporting={exporting}
          />
        )}
      </div>

      {/* ── Bottom nav ── */}
      <div className="flex items-center justify-between pt-6 border-t mt-6">
        <Button variant="outline" size="sm" onClick={currentStepIdx === 0 ? onClose : goBack}>
          {currentStepIdx === 0 ? 'Cancel' : <><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</>}
        </Button>
        <div className="flex items-center gap-2">
          {step === 'preview' ? (
            <Button size="sm" onClick={handleSave} disabled={saving || !reportName.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {editTemplate ? 'Update Report' : 'Save Report'}
            </Button>
          ) : (
            <Button size="sm" onClick={goNext} disabled={!canGoNext}>
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STEP 1: Data Source picker
// ════════════════════════════════════════════════════════════════

function StepSource({ selected, onSelect }: { selected: ReportDataSource | null; onSelect: (ds: ReportDataSource) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">Choose a data source</h3>
      <p className="text-xs text-muted-foreground mb-5">Select the type of data you want to report on. Each source has different columns and filters.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {DATA_SOURCES.map(ds => {
          const Icon = ICONS[ds.icon] || FolderKanban
          const isSelected = selected === ds.key
          return (
            <button
              key={ds.key}
              onClick={() => onSelect(ds.key)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 hover:shadow-md',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/30 bg-card',
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                </div>
              )}
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold">{ds.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{ds.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STEP 2: Column selector
// ════════════════════════════════════════════════════════════════

function StepColumns({ sourceDef, selected, onToggle, onReorder }: {
  sourceDef: DataSourceDef
  selected: string[]
  onToggle: (key: string) => void
  onReorder: (cols: string[]) => void
}) {
  const selectedCols = sourceDef.columns.filter(c => selected.includes(c.key))
  const unselectedCols = sourceDef.columns.filter(c => !selected.includes(c.key))

  const moveUp = (key: string) => {
    const idx = selected.indexOf(key)
    if (idx <= 0) return
    const next = [...selected]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onReorder(next)
  }
  const moveDown = (key: string) => {
    const idx = selected.indexOf(key)
    if (idx < 0 || idx >= selected.length - 1) return
    const next = [...selected]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onReorder(next)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">Select columns</h3>
      <p className="text-xs text-muted-foreground mb-5">Choose which columns appear in your report. Drag to reorder.</p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Selected columns (ordered) */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Included ({selectedCols.length})
          </div>
          <div className="space-y-1">
            {selected.map((key, idx) => {
              const col = sourceDef.columns.find(c => c.key === key)
              if (!col) return null
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 group"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{col.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 uppercase">{col.type}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveUp(key)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-20"
                    >
                      <ChevronDown className="h-3 w-3 rotate-180" />
                    </button>
                    <button
                      onClick={() => moveDown(key)}
                      disabled={idx === selected.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-20"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => onToggle(key)}
                    className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
            {selectedCols.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                No columns selected. Click columns on the right to add them.
              </div>
            )}
          </div>
        </div>

        {/* Available columns */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Available ({unselectedCols.length})
          </div>
          <div className="space-y-1">
            {unselectedCols.map(col => (
              <button
                key={col.key}
                onClick={() => onToggle(col.key)}
                className="w-full flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left hover:bg-primary/5 hover:border-primary/30 transition-all"
              >
                <div className="h-4 w-4 rounded border-2 border-muted-foreground/20 shrink-0" />
                <span className="text-sm text-muted-foreground">{col.label}</span>
                <span className="text-[10px] text-muted-foreground/60 ml-auto uppercase">{col.type}</span>
              </button>
            ))}
            {unselectedCols.length === 0 && (
              <div className="text-xs text-muted-foreground py-4 text-center">
                All columns selected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STEP 3: Filters & Grouping
// ════════════════════════════════════════════════════════════════

function StepFilters({ sourceDef, filters, onFiltersChange, groupBy, onGroupByChange, sortField, sortDir, onSortFieldChange, onSortDirChange, selectedColumns }: {
  sourceDef: DataSourceDef
  filters: Record<string, unknown>
  onFiltersChange: (f: Record<string, unknown>) => void
  groupBy: string | null
  onGroupByChange: (g: string | null) => void
  sortField: string | null
  sortDir: 'asc' | 'desc'
  onSortFieldChange: (f: string | null) => void
  onSortDirChange: (d: 'asc' | 'desc') => void
  selectedColumns: string[]
}) {
  const setFilter = (key: string, value: unknown) => {
    const next = { ...filters }
    if (value === '' || value === null || value === undefined) {
      delete next[key]
    } else {
      next[key] = value
    }
    onFiltersChange(next)
  }

  const sortableColumns = sourceDef.columns.filter(c => selectedColumns.includes(c.key))

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Filters</h3>
        <p className="text-xs text-muted-foreground mb-4">Narrow down the data. Leave blank to include all.</p>
        {sourceDef.filterableBy.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">
            No filters available for this data source.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sourceDef.filterableBy.map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                {f.type === 'select' && f.options ? (
                  <select
                    value={(filters[f.key] as string) ?? ''}
                    onChange={e => setFilter(f.key, e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    {f.options.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === 'year' ? (
                  <Input
                    type="number"
                    placeholder="e.g. 2026"
                    value={(filters[f.key] as number) ?? ''}
                    onChange={e => setFilter(f.key, e.target.value ? Number(e.target.value) : '')}
                    className="text-sm"
                  />
                ) : f.type === 'month' ? (
                  <select
                    value={(filters[f.key] as number) ?? ''}
                    onChange={e => setFilter(f.key, e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All months</option>
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder={`Filter by ${f.label.toLowerCase()}...`}
                    value={(filters[f.key] as string) ?? ''}
                    onChange={e => setFilter(f.key, e.target.value)}
                    className="text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group by */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Group by</h3>
        <p className="text-xs text-muted-foreground mb-3">Optionally group rows by a field for subtotals and chart breakdowns.</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onGroupByChange(null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              !groupBy ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/30',
            )}
          >
            None
          </button>
          {sourceDef.groupableBy.map(g => {
            const col = sourceDef.columns.find(c => c.key === g)
            return (
              <button
                key={g}
                onClick={() => onGroupByChange(g)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  groupBy === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                {col?.label ?? g}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort by */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Sort by</h3>
        <p className="text-xs text-muted-foreground mb-3">Choose a column and direction for sorting.</p>
        <div className="flex items-center gap-3">
          <select
            value={sortField ?? ''}
            onChange={e => onSortFieldChange(e.target.value || null)}
            className="rounded-md border bg-background px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">Default order</option>
            {sortableColumns.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          {sortField && (
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => onSortDirChange('asc')}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', sortDir === 'asc' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                A→Z
              </button>
              <button
                onClick={() => onSortDirChange('desc')}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors', sortDir === 'desc' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                Z→A
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STEP 4: Visualisation
// ════════════════════════════════════════════════════════════════

function StepVisualise({ chartType, onChartTypeChange }: {
  chartType: ReportChartType
  onChartTypeChange: (ct: ReportChartType) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">How should this report be displayed?</h3>
      <p className="text-xs text-muted-foreground mb-6">Choose a visualisation style. Charts work best with a "Group by" set in the previous step.</p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {CHART_OPTIONS.map(opt => {
          const Icon = opt.icon
          const isSelected = chartType === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => onChartTypeChange(opt.key)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/30',
              )}
            >
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold">{opt.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-xl bg-muted/50 border border-dashed px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Charts aggregate numeric columns by group. Set a "Group by" field in the Filters step to get meaningful chart breakdowns.
          Tables show all individual rows.
        </p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STEP 5: Preview & Save
// ════════════════════════════════════════════════════════════════

function StepPreview({ sourceDef, selectedColumns, data, loading, chartType, groupBy, reportName, reportDesc, isShared, onReportNameChange, onReportDescChange, onIsSharedChange, onRefresh, onExport, exporting }: {
  sourceDef: DataSourceDef
  selectedColumns: string[]
  data: ReportRow[] | null
  loading: boolean
  chartType: ReportChartType
  groupBy: string | null
  reportName: string
  reportDesc: string
  isShared: boolean
  onReportNameChange: (n: string) => void
  onReportDescChange: (d: string) => void
  onIsSharedChange: (s: boolean) => void
  onRefresh: () => void
  onExport: (format: 'excel' | 'csv') => void
  exporting: boolean
}) {
  const cols = sourceDef.columns.filter(c => selectedColumns.includes(c.key))

  // Chart rendering
  const chartData = useMemo(() => {
    if (!data || !groupBy || chartType === 'table') return null
    const groups = new Map<string, ReportRow[]>()
    for (const row of data) {
      const key = String(row[groupBy] ?? 'Other')
      const arr = groups.get(key) ?? []
      arr.push(row)
      groups.set(key, arr)
    }
    // Aggregate: count + sum of numeric columns
    const numCols = cols.filter(c => c.type === 'number' || c.type === 'currency' || c.type === 'percent')
    const firstNumCol = numCols[0]
    return Array.from(groups.entries()).map(([label, rows]) => ({
      label,
      count: rows.length,
      value: firstNumCol ? rows.reduce((sum, r) => sum + (Number(r[firstNumCol.key]) || 0), 0) : rows.length,
    }))
  }, [data, groupBy, chartType, cols])

  return (
    <div className="space-y-6">
      {/* Save config bar */}
      <div className="rounded-xl border bg-card p-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Report Name *</label>
            <Input
              placeholder="e.g. Q1 Budget Overview"
              value={reportName}
              onChange={e => onReportNameChange(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Description</label>
            <Input
              placeholder="Optional description..."
              value={reportDesc}
              onChange={e => onReportDescChange(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => onIsSharedChange(!isShared)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              isShared ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:border-primary/30',
            )}
          >
            <Share2 className="h-3 w-3" />
            {isShared ? 'Shared with org' : 'Private — only visible to you'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <Play className="h-3.5 w-3.5 mr-1" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {data ? `${data.length} row${data.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport('excel')} disabled={!data || data.length === 0 || exporting}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('csv')} disabled={!data || data.length === 0 || exporting}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Chart */}
      {chartType !== 'table' && chartData && chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <SimpleChart data={chartData} type={chartType} />
        </div>
      )}

      {/* Data table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
        </div>
      ) : data && data.length > 0 ? (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {cols.map(col => (
                    <th key={col.key} className={cn(
                      'px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                      (col.type === 'number' || col.type === 'currency' || col.type === 'percent') && 'text-right',
                    )}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 200).map((row, i) => (
                  <tr key={i} className={cn('border-b last:border-0', i % 2 === 1 && 'bg-muted/20')}>
                    {cols.map(col => (
                      <td key={col.key} className={cn(
                        'px-3 py-2 whitespace-nowrap',
                        (col.type === 'number' || col.type === 'currency' || col.type === 'percent') && 'text-right tabular-nums',
                        col.type === 'status' && 'font-medium',
                      )}>
                        {formatCell(row[col.key], col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 200 && (
            <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground text-center">
              Showing 200 of {data.length} rows. Export to see all data.
            </div>
          )}
        </div>
      ) : data && data.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Table2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No data found</p>
          <p className="text-xs mt-1">Try adjusting your filters or choosing a different data source.</p>
        </div>
      ) : null}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Simple chart component (CSS-based, no chart library needed)
// ════════════════════════════════════════════════════════════════

function SimpleChart({ data, type }: { data: { label: string; value: number; count: number }[]; type: ReportChartType }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)
  const total = data.reduce((sum, d) => sum + d.value, 0)

  const COLORS = [
    'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-violet-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
    'bg-pink-500', 'bg-teal-500',
  ]

  if (type === 'pie') {
    // Render as horizontal segmented bar (simulates pie)
    return (
      <div>
        <div className="flex rounded-full overflow-hidden h-6 mb-4">
          {data.map((d, i) => (
            <div
              key={i}
              className={cn(COLORS[i % COLORS.length], 'transition-all duration-500')}
              style={{ width: `${total > 0 ? (d.value / total) * 100 : 0}%` }}
              title={`${d.label}: ${formatNum(d.value)} (${total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <div className={cn('w-2.5 h-2.5 rounded-full', COLORS[i % COLORS.length])} />
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-semibold">{formatNum(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Bar / stacked / line — all render as horizontal bars
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-xs text-muted-foreground truncate text-right shrink-0">{d.label}</div>
          <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
            <div
              className={cn(COLORS[i % COLORS.length], 'h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2')}
              style={{ width: `${(d.value / maxValue) * 100}%`, minWidth: d.value > 0 ? '24px' : '0' }}
            >
              {d.value > 0 && <span className="text-[10px] font-bold text-white">{formatNum(d.value)}</span>}
            </div>
          </div>
          <div className="w-12 text-xs text-muted-foreground tabular-nums text-right">{d.count} rows</div>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ──

function formatCell(value: unknown, col: ColumnDef): React.ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground/40">—</span>
  switch (col.type) {
    case 'currency':
      return `€${Number(value).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'percent':
      return `${Number(value).toFixed(1)}%`
    case 'number':
      return Number(value).toLocaleString('en', { maximumFractionDigits: 2 })
    case 'date': {
      const str = String(value)
      if (!str || str === '') return <span className="text-muted-foreground/40">—</span>
      try {
        return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      } catch { return str }
    }
    case 'status': {
      const s = String(value)
      const color = s === 'Active' || s === 'Approved' || s === 'approved' || s === 'Granted' || s === 'Signed'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : s === 'Submitted' || s === 'pending' || s === 'In Preparation'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : s === 'Rejected' || s === 'rejected' || s === 'Suspended'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-muted text-muted-foreground'
      return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', color)}>{s}</span>
    }
    default:
      return String(value)
  }
}

function formatCellValue(value: unknown, col: ColumnDef): string | number {
  if (value === null || value === undefined) return ''
  if (col.type === 'currency' || col.type === 'number' || col.type === 'percent') return Number(value)
  return String(value)
}

function formatNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en', { maximumFractionDigits: 1 })
}
