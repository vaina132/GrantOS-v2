import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  Upload, FileSpreadsheet, Users, FolderKanban, FileText, Image, Sparkles,
  ArrowRight, ArrowLeft, Check, AlertTriangle, Loader2, X, Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AiQuotaWidget } from '@/components/ai/AiQuotaWidget'

// ─── Types ───────────────────────────────────────────────────

type ImportType = 'persons' | 'projects' | 'proposals'
type Step = 'upload' | 'processing' | 'map' | 'preview'
type FileCategory = 'spreadsheet' | 'document'  // spreadsheet = CSV/Excel, document = PDF/image/Word (needs AI)

interface ColumnDef {
  field: string
  label: string
  required: boolean
  aliases: string[]
}

interface ImportConfig {
  label: string
  description: string
  icon: typeof Users
  columns: ColumnDef[]
  table: string
}

// ─── Import target configs ───────────────────────────────────

const IMPORT_CONFIGS: Record<ImportType, ImportConfig> = {
  persons: {
    label: 'Staff / People',
    description: 'Team members, employees, researchers',
    icon: Users,
    columns: [
      { field: 'full_name', label: 'Full Name', required: true, aliases: ['name', 'full name', 'fullname', 'person', 'staff name', 'employee', 'employee name', 'researcher', 'member'] },
      { field: 'email', label: 'Email', required: false, aliases: ['email', 'e-mail', 'mail', 'email address', 'contact'] },
      { field: 'department', label: 'Department', required: false, aliases: ['department', 'dept', 'unit', 'division', 'group', 'team', 'lab', 'laboratory'] },
      { field: 'role', label: 'Role', required: false, aliases: ['role', 'position', 'title', 'job title', 'job role', 'function', 'designation'] },
      { field: 'employment_type', label: 'Employment Type', required: false, aliases: ['employment type', 'employment_type', 'contract', 'contract type'] },
      { field: 'fte', label: 'FTE', required: false, aliases: ['fte', 'full time equivalent', 'working time', 'percentage', 'effort'] },
      { field: 'start_date', label: 'Start Date', required: false, aliases: ['start date', 'start_date', 'startdate', 'hire date', 'from', 'joined', 'joining date'] },
      { field: 'end_date', label: 'End Date', required: false, aliases: ['end date', 'end_date', 'enddate', 'leave date', 'to', 'until', 'departure'] },
      { field: 'country', label: 'Country', required: false, aliases: ['country', 'country code', 'nation', 'location', 'nationality'] },
      { field: 'annual_salary', label: 'Annual Salary', required: false, aliases: ['salary', 'annual salary', 'annual_salary', 'pay', 'compensation', 'wage'] },
    ],
    table: 'persons',
  },
  projects: {
    label: 'Projects',
    description: 'Research projects, grants, contracts',
    icon: FolderKanban,
    columns: [
      { field: 'acronym', label: 'Acronym', required: true, aliases: ['acronym', 'code', 'project code', 'short name', 'project id', 'project acronym', 'id', 'ref', 'reference', 'abbreviation'] },
      { field: 'title', label: 'Title', required: true, aliases: ['title', 'name', 'project name', 'project title', 'full title', 'project'] },
      { field: 'start_date', label: 'Start Date', required: true, aliases: ['start date', 'start_date', 'startdate', 'start', 'from', 'begin', 'begin date', 'beginning', 'kick-off'] },
      { field: 'end_date', label: 'End Date', required: true, aliases: ['end date', 'end_date', 'enddate', 'end', 'to', 'until', 'finish', 'finish date', 'due date', 'completion'] },
      { field: 'status', label: 'Status', required: false, aliases: ['status', 'state', 'project status', 'phase', 'stage'] },
      { field: 'grant_number', label: 'Grant Number', required: false, aliases: ['grant number', 'grant_number', 'grant', 'grant id', 'grant no', 'contract number', 'agreement number', 'ga number', 'project number'] },
      { field: 'total_budget', label: 'Total Budget', required: false, aliases: ['total budget', 'total_budget', 'budget', 'total cost', 'grant amount', 'funding', 'amount', 'value'] },
      { field: 'budget_personnel', label: 'Personnel Budget', required: false, aliases: ['budget personnel', 'budget_personnel', 'personnel budget', 'personnel cost', 'staff cost', 'personnel', 'labor', 'labour'] },
      { field: 'budget_travel', label: 'Travel Budget', required: false, aliases: ['budget travel', 'budget_travel', 'travel budget', 'travel cost', 'travel', 'mobility'] },
      { field: 'budget_subcontracting', label: 'Subcontracting Budget', required: false, aliases: ['budget subcontracting', 'budget_subcontracting', 'subcontracting', 'subcontracting budget', 'outsourcing'] },
      { field: 'budget_other', label: 'Other Budget', required: false, aliases: ['budget other', 'budget_other', 'other budget', 'other cost', 'other', 'indirect', 'overhead'] },
    ],
    table: 'projects',
  },
  proposals: {
    label: 'Proposals',
    description: 'Grant proposals, applications, submissions',
    icon: FileText,
    columns: [
      { field: 'title', label: 'Title', required: true, aliases: ['title', 'name', 'proposal title', 'proposal name', 'project title'] },
      { field: 'acronym', label: 'Acronym', required: false, aliases: ['acronym', 'code', 'short name', 'abbreviation'] },
      { field: 'call_identifier', label: 'Call ID', required: false, aliases: ['call', 'call identifier', 'call_identifier', 'call id', 'call reference', 'topic id'] },
      { field: 'funding_programme', label: 'Programme', required: false, aliases: ['programme', 'program', 'funding programme', 'funding_programme', 'scheme', 'funding scheme', 'framework'] },
      { field: 'status', label: 'Status', required: false, aliases: ['status', 'state', 'stage', 'outcome', 'result', 'decision'] },
      { field: 'submission_date', label: 'Submission Date', required: false, aliases: ['submission date', 'submission_date', 'submitted', 'date', 'deadline'] },
      { field: 'requested_budget', label: 'Requested Budget', required: false, aliases: ['budget', 'requested budget', 'requested_budget', 'amount', 'funding', 'cost'] },
      { field: 'duration_months', label: 'Duration (months)', required: false, aliases: ['duration', 'duration_months', 'months', 'length', 'period'] },
    ],
    table: 'proposals',
  },
}

// ─── File type utilities ─────────────────────────────────────

const SPREADSHEET_EXTS = ['csv', 'xlsx', 'xls', 'tsv']
const DOCUMENT_EXTS = ['pdf', 'doc', 'docx', 'txt', 'rtf']
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const ALL_ACCEPT = '.csv,.xlsx,.xls,.tsv,.pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp'

const FILE_LIMITS = {
  spreadsheet: { maxSizeMB: 10, label: 'CSV / Excel — max 10 MB' },
  document: { maxSizeMB: 10, label: 'PDF / Word / Text — max 10 MB, ~50 pages' },
  image: { maxSizeMB: 5, label: 'Images — max 5 MB' },
}

function getFileExt(name: string): string {
  return name.toLowerCase().split('.').pop() || ''
}

function getFileCategory(name: string): FileCategory {
  const ext = getFileExt(name)
  if (SPREADSHEET_EXTS.includes(ext)) return 'spreadsheet'
  return 'document'
}

function getFileSizeLimitMB(name: string): number {
  const ext = getFileExt(name)
  if (IMAGE_EXTS.includes(ext)) return FILE_LIMITS.image.maxSizeMB
  if (SPREADSHEET_EXTS.includes(ext)) return FILE_LIMITS.spreadsheet.maxSizeMB
  return FILE_LIMITS.document.maxSizeMB
}

function validateFile(file: File): string | null {
  const ext = getFileExt(file.name)
  const allExts = [...SPREADSHEET_EXTS, ...DOCUMENT_EXTS, ...IMAGE_EXTS]
  if (!allExts.includes(ext)) {
    return `Unsupported file type (.${ext}). Supported: ${allExts.map((e) => `.${e}`).join(', ')}`
  }
  const limitMB = getFileSizeLimitMB(file.name)
  if (file.size > limitMB * 1024 * 1024) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum for this file type is ${limitMB} MB.`
  }
  return null
}

// ─── Fuzzy column matching ───────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-./]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchScore(header: string, alias: string): number {
  const h = normalize(header)
  const a = alias
  if (h === a) return 100
  if (h.startsWith(a) || a.startsWith(h)) return 80
  if (h.includes(a) || a.includes(h)) return 60
  const hWords = new Set(h.split(' '))
  const aWords = a.split(' ')
  const overlap = aWords.filter((w) => hWords.has(w)).length
  if (overlap > 0) return 30 + (overlap / aWords.length) * 30
  return 0
}

function autoMap(csvHeaders: string[], columns: ColumnDef[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const usedHeaders = new Set<string>()
  for (const col of columns) {
    let bestHeader = ''
    let bestScore = 0
    for (const csvH of csvHeaders) {
      if (usedHeaders.has(csvH)) continue
      const fieldScore = matchScore(csvH, normalize(col.field))
      if (fieldScore > bestScore) { bestScore = fieldScore; bestHeader = csvH }
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

// ─── Component ───────────────────────────────────────────────

interface ParsedData {
  type: ImportType
  headers: string[]
  rows: Record<string, unknown>[]
  source: 'spreadsheet' | 'ai'
}

export function BulkImport() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()

  // Wizard state
  const [step, setStep] = useState<Step>('upload')
  const [importType, setImportType] = useState<ImportType>('projects')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [userHint, setUserHint] = useState('')

  // Parsing / AI state
  const [quotaExhausted, setQuotaExhausted] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  // ─── File handling ──────────────────────────────

  const handleFileSelect = useCallback((f: File) => {
    const error = validateFile(f)
    if (error) {
      setFileError(error)
      setFile(null)
      return
    }
    setFileError(null)
    setFile(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }, [handleFileSelect])

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setFileError(null)
    setParsed(null)
    setMapping({})
    setImporting(false)
    setProcessing(false)
    setUserHint('')
  }

  // ─── Process file ───────────────────────────────

  const handleProcess = async () => {
    if (!file) return

    const category = getFileCategory(file.name)

    if (category === 'spreadsheet') {
      // Client-side parsing for CSV/Excel
      setProcessing(true)
      setProcessingMessage('Reading spreadsheet...')
      try {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        if (jsonRows.length === 0) {
          toast({ title: 'Empty file', description: 'The uploaded file has no data rows.', variant: 'destructive' })
          setProcessing(false)
          return
        }

        const headers = Object.keys(jsonRows[0])
        const config = IMPORT_CONFIGS[importType]
        const autoMapping = autoMap(headers, config.columns)

        setParsed({ type: importType, headers, rows: jsonRows, source: 'spreadsheet' })
        setMapping(autoMapping)
        setStep('map')
      } catch {
        toast({ title: 'Parse error', description: 'Could not read the file. Make sure it\'s a valid CSV or Excel file.', variant: 'destructive' })
      } finally {
        setProcessing(false)
      }
    } else {
      // AI extraction for PDF / images / Word
      setProcessing(true)
      setProcessingMessage('Uploading file...')
      try {
        // 1. Upload to Supabase Storage
        const storagePath = `import-temp/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('grant-uploads')
          .upload(storagePath, file, { contentType: file.type, upsert: false })

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

        try {
          // 2. Call AI extraction API
          setProcessingMessage('AI is reading your document...')
          const response = await apiFetch('/api/ai?action=parse-import', {
            method: 'POST',
            body: JSON.stringify({
              storage_path: storagePath,
              file_name: file.name,
              import_type: importType,
              user_instructions: userHint.trim() || undefined,
              org_id: useAuthStore.getState().orgId || '',
              user_id: useAuthStore.getState().user?.id || '',
            }),
          })

          if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
            throw new Error(errData.error || `AI extraction failed (${response.status})`)
          }

          setProcessingMessage('Processing results...')
          const data = await response.json()
          const rows: Record<string, unknown>[] = data.extraction?.rows ?? []

          if (rows.length === 0) {
            toast({ title: 'No data found', description: 'AI could not extract any records from this document. Try a different file or add hints.', variant: 'destructive' })
            setProcessing(false)
            return
          }

          // Remove internal fields from headers
          const allKeys = new Set<string>()
          for (const row of rows) {
            for (const key of Object.keys(row)) allKeys.add(key)
          }
          const internalFields = ['confidence', '_notes']
          const headers = [...allKeys].filter((k) => !internalFields.includes(k))
          const config = IMPORT_CONFIGS[importType]
          const autoMapping = autoMap(headers, config.columns)

          setParsed({ type: importType, headers, rows, source: 'ai' })
          setMapping(autoMapping)
          setStep('map')

          const avgConfidence = rows.reduce((sum, r) => sum + (Number(r.confidence) || 0), 0) / rows.length
          if (avgConfidence < 70) {
            toast({ title: 'Low confidence', description: 'AI extraction confidence is below 70%. Please review the data carefully.', variant: 'default' })
          }
        } finally {
          // 3. Clean up temp file
          await supabase.storage.from('grant-uploads').remove([storagePath]).catch(() => {})
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process file'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      } finally {
        setProcessing(false)
      }
    }
  }

  // ─── Mapping ────────────────────────────────────

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

  // ─── Import ─────────────────────────────────────

  const handleImport = async () => {
    if (!parsed || !orgId || !config) return
    setImporting(true)
    try {
      const rows = getMappedRows()
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

  const downloadTemplate = () => {
    const cfg = IMPORT_CONFIGS[importType]
    const headers = cfg.columns.map((c) => c.field)
    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, cfg.label)
    XLSX.writeFile(wb, `${importType}_template.xlsx`)
  }

  // ─── Step indicators ───────────────────────────
  const steps = [
    { key: 'upload', label: 'Upload' },
    { key: 'processing', label: 'Process' },
    { key: 'map', label: 'Map' },
    { key: 'preview', label: 'Import' },
  ]
  const currentStepIdx = steps.findIndex((s) => s.key === step)

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={cn(
            'flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium transition-colors',
            i < currentStepIdx ? 'bg-primary text-primary-foreground' :
            i === currentStepIdx ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
            'bg-muted text-muted-foreground',
          )}>
            {i < currentStepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={cn(
            'text-xs ml-1.5 hidden sm:inline',
            i === currentStepIdx ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}>{s.label}</span>
          {i < steps.length - 1 && <div className="w-6 sm:w-10 h-px bg-border mx-1.5" />}
        </div>
      ))}
    </div>
  )

  const fileCategory = file ? getFileCategory(file.name) : null
  const isAIFile = fileCategory === 'document'

  // ═══════════════════════════════════════════════
  // STEP 1: Upload
  // ═══════════════════════════════════════════════
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Import Data"
          description="Upload files to import staff, projects, or proposals. We support spreadsheets, PDFs, images, and documents."
        />
        <StepIndicator />

        {/* Import type selector */}
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(IMPORT_CONFIGS) as [ImportType, ImportConfig][]).map(([type, cfg]) => {
            const Icon = cfg.icon
            const selected = importType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setImportType(type)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all text-center',
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border',
                )}
              >
                <Icon className={cn('h-6 w-6', selected ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', selected ? 'text-foreground' : 'text-muted-foreground')}>{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{cfg.description}</span>
              </button>
            )
          })}
        </div>

        {/* Drop zone */}
        <Card>
          <CardContent className="pt-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                dragOver ? 'border-primary bg-primary/5' :
                file ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' :
                'border-muted-foreground/25 hover:border-muted-foreground/50',
              )}
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              {file ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {isAIFile ? <Sparkles className="h-8 w-8 text-amber-500" /> : <FileSpreadsheet className="h-8 w-8 text-emerald-600" />}
                  </div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB ·
                    {isAIFile ? ' Will use AI to extract data' : ' Will parse as spreadsheet'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setFile(null); setFileError(null) }}
                    className="text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                  <div>
                    <p className="font-medium">Drop a file here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      CSV, Excel, PDF, Word, or images (JPG, PNG)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    {[
                      { icon: FileSpreadsheet, label: 'CSV / Excel', sub: '≤ 10 MB' },
                      { icon: FileText, label: 'PDF / Word', sub: '≤ 10 MB · AI' },
                      { icon: Image, label: 'Images', sub: '≤ 5 MB · AI' },
                    ].map((fmt) => (
                      <span key={fmt.label} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                        <fmt.icon className="h-3 w-3" /> {fmt.label} <span className="text-muted-foreground/60">{fmt.sub}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input
              id="import-file-input"
              type="file"
              accept={ALL_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
                e.target.value = ''
              }}
            />
            {fileError && (
              <p className="text-sm text-destructive mt-3 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {fileError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI hint (for document files) */}
        {file && isAIFile && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Help the AI (optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="user-hint" className="text-xs text-muted-foreground">
                  Describe what's in this file to help AI extract data more accurately
                </Label>
                <Input
                  id="user-hint"
                  placeholder="e.g. 'This PDF is a list of our research staff with their departments and salaries'"
                  value={userHint}
                  onChange={(e) => setUserHint(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Quota (for document files) */}
        {file && isAIFile && (
          <AiQuotaWidget onQuotaExhausted={setQuotaExhausted} />
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Download Template
          </Button>
          <Button onClick={handleProcess} disabled={!file || processing || (isAIFile && quotaExhausted)}>
            {isAIFile && <Sparkles className="mr-1 h-4 w-4" />}
            {!isAIFile && <ArrowRight className="mr-1 h-4 w-4" />}
            {isAIFile ? 'Extract with AI' : 'Parse & Continue'}
          </Button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STEP 2: Processing
  // ═══════════════════════════════════════════════
  if (processing) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('import.importData')} />
        <StepIndicator />
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                {isAIFile && <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1" />}
              </div>
              <div>
                <p className="font-medium text-lg">{processingMessage}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAIFile
                    ? 'AI is analyzing your document. This may take 15–30 seconds.'
                    : 'Parsing your spreadsheet...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STEP 3: Map columns
  // ═══════════════════════════════════════════════
  if (step === 'map' && parsed && config) {
    const mappedCount = Object.keys(mapping).length
    const totalColumns = config.columns.length

    return (
      <div className="space-y-6">
        <PageHeader
          title="Map Columns"
          description={`${parsed.rows.length} record${parsed.rows.length !== 1 ? 's' : ''} found${parsed.source === 'ai' ? ' by AI' : ''}. Match columns to the expected fields.`}
        />
        <StepIndicator />

        {parsed.source === 'ai' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 p-3">
            <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Data was extracted by AI. Column mapping has been auto-detected. Please review carefully — AI results may need corrections.
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Column Mapping</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {mappedCount} / {totalColumns} mapped
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium w-[180px]">Target Field</th>
                    <th className="px-3 py-2 text-left font-medium">Your Column</th>
                    <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Sample Data</th>
                    <th className="px-3 py-2 text-center font-medium w-[50px]"></th>
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
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-sm">{col.label}</span>
                          {col.required && <span className="text-destructive ml-0.5">*</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={csvHeader}
                            onChange={(e) => handleMappingChange(col.field, e.target.value)}
                            className={cn(
                              'w-full rounded-md border px-2 py-1.5 text-sm bg-background',
                              !isMapped && col.required && 'border-destructive/50',
                            )}
                          >
                            <option value="">— Skip —</option>
                            {parsed.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          {sampleValues.length > 0 ? (
                            <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
                              {sampleValues.join(' · ')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isMapped ? (
                            <Check className="h-4 w-4 text-emerald-600 inline-block" />
                          ) : col.required ? (
                            <AlertTriangle className="h-4 w-4 text-destructive inline-block" />
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-between">
          <Button variant="outline" onClick={handleReset}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Start Over
          </Button>
          <Button onClick={handleConfirmMapping} disabled={!allMappedRequired}>
            <ArrowRight className="mr-1 h-4 w-4" /> Preview & Import
          </Button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STEP 4: Preview & Import
  // ═══════════════════════════════════════════════
  if (step === 'preview' && parsed && config) {
    const mappedRows = getMappedRows()
    const mappedFields = Object.keys(mapping)

    return (
      <div className="space-y-6">
        <PageHeader
          title="Review & Import"
          description={`${mappedRows.length} record${mappedRows.length !== 1 ? 's' : ''} ready to import into ${config.label.toLowerCase()}.`}
        />
        <StepIndicator />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Data Preview</CardTitle>
              <Badge variant="secondary" className="text-xs">{mappedRows.length} rows</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/80 backdrop-blur-sm">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">#</th>
                    {mappedFields.map((field) => (
                      <th key={field} className="px-2 py-1.5 text-left font-medium">{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 25).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                      {mappedFields.map((field) => (
                        <td key={field} className="px-2 py-1.5 max-w-[160px] truncate">
                          {String(row[field] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {mappedRows.length > 25 && (
                    <tr>
                      <td colSpan={mappedFields.length + 1} className="px-2 py-2.5 text-center text-muted-foreground text-xs">
                        ... and {mappedRows.length - 25} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('map')} disabled={importing}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Mapping
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={importing}>
              Cancel
            </Button>
          </div>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            {importing ? 'Importing...' : `Import ${mappedRows.length} rows`}
          </Button>
        </div>
      </div>
    )
  }

  return null
}
