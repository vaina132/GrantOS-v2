import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Upload, FileSpreadsheet, Users, FolderKanban, CalendarDays, CalendarOff, ArrowRight, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ImportType = 'persons' | 'projects' | 'assignments' | 'absences'

interface ColumnDef {
  field: string
  label: string
  required: boolean
  aliases: string[]   // fuzzy match aliases (lowercased)
}

interface ImportConfig {
  label: string
  description: string
  icon: typeof Users
  columns: ColumnDef[]
  table: string
}

const IMPORT_CONFIGS: Record<ImportType, ImportConfig> = {
  persons: {
    label: 'Staff / Persons',
    description: 'Import staff members with name, email, department, role, etc.',
    icon: Users,
    columns: [
      { field: 'full_name', label: 'Full Name', required: true, aliases: ['name', 'full name', 'fullname', 'person', 'staff name', 'employee', 'employee name'] },
      { field: 'email', label: 'Email', required: false, aliases: ['email', 'e-mail', 'mail', 'email address'] },
      { field: 'department', label: 'Department', required: false, aliases: ['department', 'dept', 'unit', 'division', 'group'] },
      { field: 'role', label: 'Role', required: false, aliases: ['role', 'position', 'title', 'job title', 'job role', 'function'] },
      { field: 'employment_type', label: 'Employment Type', required: false, aliases: ['employment type', 'employment_type', 'type', 'contract', 'contract type', 'status'] },
      { field: 'fte', label: 'FTE', required: false, aliases: ['fte', 'full time equivalent', 'working time', 'percentage'] },
      { field: 'start_date', label: 'Start Date', required: false, aliases: ['start date', 'start_date', 'startdate', 'hire date', 'from', 'joined'] },
      { field: 'end_date', label: 'End Date', required: false, aliases: ['end date', 'end_date', 'enddate', 'leave date', 'to', 'until'] },
      { field: 'country', label: 'Country', required: false, aliases: ['country', 'country code', 'nation', 'location'] },
    ],
    table: 'persons',
  },
  projects: {
    label: 'Projects',
    description: 'Import projects with acronym, title, dates, budgets, etc.',
    icon: FolderKanban,
    columns: [
      { field: 'acronym', label: 'Acronym', required: true, aliases: ['acronym', 'code', 'project code', 'short name', 'project id', 'project acronym', 'id', 'ref', 'reference'] },
      { field: 'title', label: 'Title', required: true, aliases: ['title', 'name', 'project name', 'project title', 'full title', 'description', 'project'] },
      { field: 'start_date', label: 'Start Date', required: true, aliases: ['start date', 'start_date', 'startdate', 'start', 'from', 'begin', 'begin date', 'beginning'] },
      { field: 'end_date', label: 'End Date', required: true, aliases: ['end date', 'end_date', 'enddate', 'end', 'to', 'until', 'finish', 'finish date', 'due date'] },
      { field: 'status', label: 'Status', required: false, aliases: ['status', 'state', 'project status', 'phase'] },
      { field: 'grant_number', label: 'Grant Number', required: false, aliases: ['grant number', 'grant_number', 'grant', 'grant id', 'grant no', 'contract number', 'agreement number', 'ga number'] },
      { field: 'total_budget', label: 'Total Budget', required: false, aliases: ['total budget', 'total_budget', 'budget', 'total cost', 'grant amount', 'funding', 'amount'] },
      { field: 'budget_personnel', label: 'Personnel Budget', required: false, aliases: ['budget personnel', 'budget_personnel', 'personnel budget', 'personnel cost', 'staff cost', 'personnel'] },
      { field: 'budget_travel', label: 'Travel Budget', required: false, aliases: ['budget travel', 'budget_travel', 'travel budget', 'travel cost', 'travel'] },
      { field: 'budget_subcontracting', label: 'Subcontracting Budget', required: false, aliases: ['budget subcontracting', 'budget_subcontracting', 'subcontracting', 'subcontracting budget'] },
      { field: 'budget_other', label: 'Other Budget', required: false, aliases: ['budget other', 'budget_other', 'other budget', 'other cost', 'other'] },
    ],
    table: 'projects',
  },
  assignments: {
    label: 'Assignments',
    description: 'Import person-month allocations to projects.',
    icon: CalendarDays,
    columns: [
      { field: 'person_id', label: 'Person ID', required: true, aliases: ['person_id', 'person id', 'staff id', 'employee id'] },
      { field: 'project_id', label: 'Project ID', required: true, aliases: ['project_id', 'project id'] },
      { field: 'year', label: 'Year', required: true, aliases: ['year'] },
      { field: 'month', label: 'Month', required: true, aliases: ['month'] },
      { field: 'pms', label: 'Person Months', required: true, aliases: ['pms', 'person months', 'pm', 'person-months', 'allocation'] },
      { field: 'type', label: 'Type', required: false, aliases: ['type', 'assignment type'] },
    ],
    table: 'assignments',
  },
  absences: {
    label: 'Absences',
    description: 'Import leave / absence records.',
    icon: CalendarOff,
    columns: [
      { field: 'person_id', label: 'Person ID', required: true, aliases: ['person_id', 'person id', 'staff id', 'employee id'] },
      { field: 'type', label: 'Type', required: true, aliases: ['type', 'absence type', 'leave type', 'reason'] },
      { field: 'start_date', label: 'Start Date', required: false, aliases: ['start date', 'start_date', 'startdate', 'from'] },
      { field: 'end_date', label: 'End Date', required: false, aliases: ['end date', 'end_date', 'enddate', 'to', 'until'] },
      { field: 'days', label: 'Days', required: false, aliases: ['days', 'day count', 'duration', 'number of days'] },
    ],
    table: 'absences',
  },
}

// ─── Fuzzy column matching ───────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-./]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Score how well a CSV header matches a column alias (0 = no match, higher = better) */
function matchScore(header: string, alias: string): number {
  const h = normalize(header)
  const a = alias
  if (h === a) return 100                    // exact
  if (h.startsWith(a) || a.startsWith(h)) return 80  // prefix
  if (h.includes(a) || a.includes(h)) return 60      // substring
  // word overlap
  const hWords = new Set(h.split(' '))
  const aWords = a.split(' ')
  const overlap = aWords.filter((w) => hWords.has(w)).length
  if (overlap > 0) return 30 + (overlap / aWords.length) * 30
  return 0
}

/** Auto-map CSV headers to target columns. Returns { targetField -> csvHeader } */
function autoMap(csvHeaders: string[], columns: ColumnDef[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const usedHeaders = new Set<string>()

  // For each target column, find the best matching CSV header
  for (const col of columns) {
    let bestHeader = ''
    let bestScore = 0

    for (const csvH of csvHeaders) {
      if (usedHeaders.has(csvH)) continue
      // Check against field name itself
      const fieldScore = matchScore(csvH, normalize(col.field))
      if (fieldScore > bestScore) { bestScore = fieldScore; bestHeader = csvH }
      // Check against all aliases
      for (const alias of col.aliases) {
        const s = matchScore(csvH, alias)
        if (s > bestScore) { bestScore = s; bestHeader = csvH }
      }
    }

    if (bestScore >= 30 && bestHeader) {
      mapping[col.field] = bestHeader
      usedHeaders.add(bestHeader)
    }
  }

  return mapping
}

// ─── Step type ───────────────────────────────────────────────
type Step = 'select' | 'map' | 'preview'

interface ParsedFile {
  type: ImportType
  headers: string[]
  rows: Record<string, unknown>[]
}

// ─── Component ───────────────────────────────────────────────

export function BulkImport() {
  const { orgId } = useAuthStore()
  const [step, setStep] = useState<Step>('select')
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})  // targetField -> csvHeader

  const handleFileSelect = useCallback((type: ImportType, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        if (jsonRows.length === 0) {
          toast({ title: 'Empty file', description: 'The uploaded file has no data rows.', variant: 'destructive' })
          return
        }

        const headers = Object.keys(jsonRows[0])
        const config = IMPORT_CONFIGS[type]
        const autoMapping = autoMap(headers, config.columns)

        setParsed({ type, headers, rows: jsonRows })
        setMapping(autoMapping)
        setStep('map')
      } catch {
        toast({ title: 'Parse error', description: 'Could not parse the file. Please use .xlsx or .csv format.', variant: 'destructive' })
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleReset = () => {
    setStep('select')
    setParsed(null)
    setMapping({})
    setImporting(false)
  }

  const handleMappingChange = (targetField: string, csvHeader: string) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (csvHeader === '') {
        delete next[targetField]
      } else {
        next[targetField] = csvHeader
      }
      return next
    })
  }

  const config = parsed ? IMPORT_CONFIGS[parsed.type] : null
  const requiredColumns = config?.columns.filter((c) => c.required) ?? []
  const allMappedRequired = requiredColumns.every((c) => mapping[c.field])

  // Transform rows using the mapping
  const getMappedRows = () => {
    if (!parsed) return []
    return parsed.rows.map((row) => {
      const mapped: Record<string, unknown> = { org_id: orgId }
      for (const [targetField, csvHeader] of Object.entries(mapping)) {
        if (csvHeader && row[csvHeader] !== undefined) {
          mapped[targetField] = row[csvHeader]
        }
      }
      return mapped
    })
  }

  const handleConfirmMapping = () => {
    if (!allMappedRequired) {
      toast({
        title: 'Missing required mappings',
        description: `Please map all required fields: ${requiredColumns.filter((c) => !mapping[c.field]).map((c) => c.label).join(', ')}`,
        variant: 'destructive',
      })
      return
    }
    setStep('preview')
  }

  const handleImport = async () => {
    if (!parsed || !orgId || !config) return
    setImporting(true)
    try {
      const rows = getMappedRows()

      // Insert in batches of 100
      const batchSize = 100
      let inserted = 0
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error } = await (supabase.from as any)(config.table).insert(batch)
        if (error) throw error
        inserted += batch.length
      }

      toast({ title: 'Import complete', description: `${inserted} ${config.label.toLowerCase()} imported successfully.` })
      handleReset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = (type: ImportType) => {
    const cfg = IMPORT_CONFIGS[type]
    const headers = cfg.columns.map((c) => c.field)
    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, cfg.label)
    XLSX.writeFile(wb, `${type}_template.xlsx`)
  }

  // ─── Step: Select ──────────────────────────────
  if (step === 'select') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bulk Import"
          description="Import data from Excel or CSV files. Column names are auto-detected."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {(Object.entries(IMPORT_CONFIGS) as [ImportType, ImportConfig][]).map(([type, cfg]) => {
            const Icon = cfg.icon
            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{cfg.label}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{cfg.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadTemplate(type)}>
                      <FileSpreadsheet className="mr-1 h-4 w-4" /> Template
                    </Button>
                    <label>
                      <Button size="sm" asChild>
                        <span><Upload className="mr-1 h-4 w-4" /> Upload</span>
                      </Button>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelect(type, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Step: Map columns ──────────────────────────
  if (step === 'map' && parsed && config) {
    const mappedCount = Object.keys(mapping).length
    const totalColumns = config.columns.length

    return (
      <div className="space-y-6">
        <PageHeader
          title={`Map Columns — ${config.label}`}
          description={`${parsed.rows.length} rows found. Match your file's columns to the expected fields.`}
        />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Column Mapping</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {mappedCount} of {totalColumns} mapped
              </Badge>
            </div>
            <CardDescription className="text-xs">
              We auto-detected {mappedCount} column{mappedCount !== 1 ? 's' : ''}. Adjust any incorrect mappings below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium w-[200px]">Target Field</th>
                    <th className="px-3 py-2 text-left font-medium">Your Column</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Sample Data</th>
                    <th className="px-3 py-2 text-center font-medium w-[60px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {config.columns.map((col) => {
                    const csvHeader = mapping[col.field] ?? ''
                    const isMapped = !!csvHeader
                    const sampleValues = isMapped
                      ? parsed.rows.slice(0, 3).map((r) => String(r[csvHeader] ?? '')).filter(Boolean)
                      : []

                    return (
                      <tr key={col.field} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{col.label}</span>
                            {col.required && <span className="text-destructive text-xs">*</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{col.field}</div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={csvHeader}
                            onChange={(e) => handleMappingChange(col.field, e.target.value)}
                            className={cn(
                              'w-full rounded-md border px-2 py-1.5 text-sm bg-background',
                              !isMapped && col.required && 'border-destructive/50',
                            )}
                          >
                            <option value="">— Not mapped —</option>
                            {parsed.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          {sampleValues.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {sampleValues.join(', ')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isMapped ? (
                            <Check className="h-4 w-4 text-emerald-600 inline-block" />
                          ) : col.required ? (
                            <AlertTriangle className="h-4 w-4 text-destructive inline-block" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>Cancel</Button>
          <Button onClick={handleConfirmMapping} disabled={!allMappedRequired}>
            <ArrowRight className="mr-1 h-4 w-4" /> Continue to Preview
          </Button>
        </div>
      </div>
    )
  }

  // ─── Step: Preview & Import ─────────────────────
  if (step === 'preview' && parsed && config) {
    const mappedRows = getMappedRows()
    const mappedFields = Object.keys(mapping)

    return (
      <div className="space-y-6">
        <PageHeader
          title={`Preview — ${config.label}`}
          description={`${mappedRows.length} rows ready to import. Review the mapped data below.`}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Mapped Data Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-1 text-left font-medium">#</th>
                    {mappedFields.map((field) => (
                      <th key={field} className="px-2 py-1 text-left font-medium">{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                      {mappedFields.map((field) => (
                        <td key={field} className="px-2 py-1 max-w-[150px] truncate">
                          {String(row[field] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {mappedRows.length > 20 && (
                    <tr>
                      <td colSpan={mappedFields.length + 1} className="px-2 py-2 text-center text-muted-foreground">
                        ... and {mappedRows.length - 20} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep('map')} disabled={importing}>
            Back to Mapping
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            <Upload className="mr-1 h-4 w-4" />
            {importing ? 'Importing...' : `Import ${mappedRows.length} rows`}
          </Button>
        </div>
      </div>
    )
  }

  return null
}
