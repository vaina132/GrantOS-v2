import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import {
  executeReport,
  getDataSource,
  type ReportRow,
  type ColumnDef,
} from '@/services/reportTemplateService'
import type { ReportTemplate, ReportChartType } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import {
  Maximize2, Minimize2, Download, RefreshCw, LayoutDashboard,
  X, Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

const CHART_COLORS = [
  'hsl(var(--primary))',
  '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#6366f1',
  '#ec4899', '#14b8a6',
]

interface ReportWidgetProps {
  template: ReportTemplate
  /** Compact mode for dashboard embedding */
  compact?: boolean
  /** Show "Add to Dashboard" / "Remove from Dashboard" toggle */
  showDashboardToggle?: boolean
  onToggleDashboard?: (template: ReportTemplate) => void
  /** Show close/collapse button */
  onClose?: () => void
  /** Custom className */
  className?: string
}

export function ReportWidget({
  template,
  compact = false,
  showDashboardToggle = false,
  onToggleDashboard,
  onClose,
  className,
}: ReportWidgetProps) {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [data, setData] = useState<ReportRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const ds = getDataSource(template.data_source)
  const cols = ds?.columns.filter(c => template.config.columns.includes(c.key)) ?? []

  const fetchData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await executeReport(orgId, globalYear, template.data_source, template.config)
      setData(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [orgId, globalYear, template.data_source, template.config])

  useEffect(() => { fetchData() }, [fetchData])

  const chartType = template.config.chart_type ?? 'table'
  const groupBy = template.config.group_by

  // Aggregate data for charts
  const chartData = useMemo(() => {
    if (!data || chartType === 'table' || !groupBy) return null
    const groups = new Map<string, ReportRow[]>()
    for (const row of data) {
      const key = String(row[groupBy] ?? 'Other')
      const arr = groups.get(key) ?? []
      arr.push(row)
      groups.set(key, arr)
    }
    const numCols = cols.filter(c => c.type === 'number' || c.type === 'currency' || c.type === 'percent')
    const firstNumCol = numCols[0]
    return Array.from(groups.entries()).map(([name, rows]) => ({
      name,
      value: firstNumCol ? rows.reduce((sum, r) => sum + (Number(r[firstNumCol.key]) || 0), 0) : rows.length,
      count: rows.length,
    }))
  }, [data, chartType, groupBy, cols])

  const handleExport = () => {
    if (!data || data.length === 0) return
    const headers = cols.map(c => c.label)
    const dataRows = data.map(row => cols.map(c => {
      const v = row[c.key]
      if (v === null || v === undefined) return ''
      if (c.type === 'number' || c.type === 'currency' || c.type === 'percent') return Number(v)
      return String(v)
    }))
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, template.name.slice(0, 31))
    XLSX.writeFile(wb, `${template.name.replace(/\s+/g, '_')}.xlsx`)
  }

  const chartHeight = compact ? 180 : expanded ? 350 : 250
  const tableMaxRows = compact ? 8 : expanded ? 100 : 15

  return (
    <Card className={cn('overflow-hidden transition-all', expanded && 'col-span-full', className)}>
      <CardHeader className={cn('pb-2', compact && 'py-3 px-4')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className={cn('text-sm font-semibold truncate', compact && 'text-xs')}>
              {template.name}
            </CardTitle>
            {template.is_pinned && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wide">
                Dashboard
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData} title="Refresh">
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            </Button>
            {!compact && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExport} title="Export Excel" disabled={!data || data.length === 0}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)} title={expanded ? 'Collapse' : 'Expand'}>
                  {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </>
            )}
            {showDashboardToggle && onToggleDashboard && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-6 w-6', template.is_pinned && 'text-primary')}
                onClick={() => onToggleDashboard(template)}
                title={template.is_pinned ? 'Remove from Dashboard' : 'Add to Dashboard'}
              >
                <LayoutDashboard className="h-3 w-3" />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Close">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {template.description && !compact && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{template.description}</p>
        )}
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'px-4 pb-3')}>
        {loading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className={cn('w-full', compact ? 'h-32' : 'h-40')} />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>Retry</Button>
          </div>
        ) : data && data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Table2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No data for current filters</p>
          </div>
        ) : chartType !== 'table' && chartData && chartData.length > 0 ? (
          <RechartsView chartType={chartType} chartData={chartData} height={chartHeight} />
        ) : data ? (
          <DataTable cols={cols} data={data} maxRows={tableMaxRows} compact={compact} />
        ) : null}

        {/* Row count footer */}
        {data && data.length > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <span className="text-[10px] text-muted-foreground">
              {data.length} row{data.length !== 1 ? 's' : ''}
              {chartType !== 'table' && chartData ? ` · ${chartData.length} groups` : ''}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">{ds?.label ?? template.data_source}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════
// Recharts-based visualisation
// ════════════════════════════════════════════════════════════════

function RechartsView({ chartType, chartData, height }: {
  chartType: ReportChartType
  chartData: { name: string; value: number; count: number }[]
  height: number
}) {
  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={height * 0.35}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={false}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: number) => val.toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(val: number) => val.toLocaleString()} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // bar + stacked_bar render as bar charts
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(val: number) => val.toLocaleString()} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ════════════════════════════════════════════════════════════════
// Compact data table
// ════════════════════════════════════════════════════════════════

function DataTable({ cols, data, maxRows, compact }: { cols: ColumnDef[]; data: ReportRow[]; maxRows: number; compact: boolean }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              {cols.map(col => (
                <th key={col.key} className={cn(
                  'px-2 py-1.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                  compact ? 'text-[9px]' : 'text-[10px]',
                  (col.type === 'number' || col.type === 'currency' || col.type === 'percent') && 'text-right',
                )}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, maxRows).map((row, i) => (
              <tr key={i} className={cn('border-b last:border-0', i % 2 === 1 && 'bg-muted/20')}>
                {cols.map(col => (
                  <td key={col.key} className={cn(
                    'px-2 py-1 whitespace-nowrap',
                    (col.type === 'number' || col.type === 'currency' || col.type === 'percent') && 'text-right tabular-nums',
                  )}>
                    {formatCellCompact(row[col.key], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground text-center">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  )
}

function formatCellCompact(value: unknown, col: ColumnDef): React.ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground/30">—</span>
  switch (col.type) {
    case 'currency':
      return `€${Number(value).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'percent':
      return `${Number(value).toFixed(1)}%`
    case 'number':
      return Number(value).toLocaleString('en', { maximumFractionDigits: 2 })
    case 'date': {
      try { return new Date(String(value)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) } catch { return String(value) }
    }
    case 'status': {
      const s = String(value)
      const color = s === 'Active' || s === 'Approved' || s === 'approved' || s === 'Granted' || s === 'Signed'
        ? 'text-emerald-600 dark:text-emerald-400'
        : s === 'Submitted' || s === 'pending' || s === 'In Preparation'
        ? 'text-amber-600 dark:text-amber-400'
        : s === 'Rejected' || s === 'rejected' || s === 'Suspended'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'
      return <span className={cn('font-medium text-[10px]', color)}>{s}</span>
    }
    default:
      return String(value)
  }
}
