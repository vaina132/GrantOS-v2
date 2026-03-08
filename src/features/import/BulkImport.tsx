import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { Upload, FileSpreadsheet, Users, FolderKanban, CalendarDays, CalendarOff } from 'lucide-react'

type ImportType = 'persons' | 'projects' | 'assignments' | 'absences'

interface ImportConfig {
  label: string
  description: string
  icon: typeof Users
  requiredColumns: string[]
  table: string
}

const IMPORT_CONFIGS: Record<ImportType, ImportConfig> = {
  persons: {
    label: 'Staff / Persons',
    description: 'Import staff members. Required columns: full_name, email, department, role, employment_type, fte',
    icon: Users,
    requiredColumns: ['full_name'],
    table: 'persons',
  },
  projects: {
    label: 'Projects',
    description: 'Import projects. Required columns: acronym, title, start_date, end_date',
    icon: FolderKanban,
    requiredColumns: ['acronym', 'title', 'start_date', 'end_date'],
    table: 'projects',
  },
  assignments: {
    label: 'Assignments',
    description: 'Import PM allocations. Required columns: person_id, project_id, year, month, pms, type',
    icon: CalendarDays,
    requiredColumns: ['person_id', 'project_id', 'year', 'month', 'pms'],
    table: 'assignments',
  },
  absences: {
    label: 'Absences',
    description: 'Import absences. Required columns: person_id, type, start_date, end_date, days',
    icon: CalendarOff,
    requiredColumns: ['person_id', 'type'],
    table: 'absences',
  },
}

export function BulkImport() {
  const { orgId } = useAuthStore()
  const [importing, setImporting] = useState<ImportType | null>(null)
  const [preview, setPreview] = useState<{ type: ImportType; headers: string[]; rows: Record<string, unknown>[] } | null>(null)

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
        const missing = config.requiredColumns.filter((col) => !headers.includes(col))

        if (missing.length > 0) {
          toast({
            title: 'Missing columns',
            description: `Required columns not found: ${missing.join(', ')}`,
            variant: 'destructive',
          })
          return
        }

        setPreview({ type, headers, rows: jsonRows })
      } catch {
        toast({ title: 'Parse error', description: 'Could not parse the file. Please use .xlsx or .csv format.', variant: 'destructive' })
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleImport = async () => {
    if (!preview || !orgId) return
    setImporting(preview.type)
    try {
      const config = IMPORT_CONFIGS[preview.type]
      const rows = preview.rows.map((row) => ({
        ...row,
        org_id: orgId,
      }))

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
      setPreview(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setImporting(null)
    }
  }

  const downloadTemplate = (type: ImportType) => {
    const config = IMPORT_CONFIGS[type]
    const ws = XLSX.utils.aoa_to_sheet([config.requiredColumns])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, config.label)
    XLSX.writeFile(wb, `${type}_template.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Import"
        description="Import data from Excel/CSV files"
      />

      {!preview ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.entries(IMPORT_CONFIGS) as [ImportType, ImportConfig][]).map(([type, config]) => {
            const Icon = config.icon
            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{config.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadTemplate(type)}
                    >
                      <FileSpreadsheet className="mr-1 h-4 w-4" /> Template
                    </Button>
                    <label>
                      <Button size="sm" asChild>
                        <span>
                          <Upload className="mr-1 h-4 w-4" /> Upload
                        </span>
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
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Preview: {IMPORT_CONFIGS[preview.type].label} ({preview.rows.length} rows)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-1 text-left font-medium">#</th>
                      {preview.headers.map((h) => (
                        <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        {preview.headers.map((h) => (
                          <td key={h} className="px-2 py-1 max-w-[150px] truncate">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {preview.rows.length > 20 && (
                      <tr>
                        <td colSpan={preview.headers.length + 1} className="px-2 py-2 text-center text-muted-foreground">
                          ... and {preview.rows.length - 20} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={!!importing}>Cancel</Button>
            <Button onClick={handleImport} disabled={!!importing}>
              <Upload className="mr-1 h-4 w-4" />
              {importing ? 'Importing...' : `Import ${preview.rows.length} rows`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
