import { supabase } from '@/lib/supabase'

export interface ExportOptions {
  orgId: string
  projectId?: string
  format: 'json' | 'csv'
}

async function fetchTable(table: string, orgId: string, projectId?: string) {
  let query = (supabase.from as any)(table).select('*').eq('org_id', orgId)
  if (projectId) {
    query = query.eq('project_id', projectId)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          if (val == null) return ''
          const str = String(val)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(',')
    ),
  ]
  return lines.join('\n')
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const PROJECT_TABLES = ['projects', 'work_packages', 'assignments', 'pm_budgets', 'timesheet_entries', 'absences', 'financial_budgets', 'project_documents']
const ORG_TABLES = ['organisations', 'org_members', 'funding_schemes', 'persons', ...PROJECT_TABLES, 'period_locks']

export const exportService = {
  async exportProject(orgId: string, projectId: string, format: 'json' | 'csv' = 'json') {
    const result: Record<string, unknown[]> = {}

    for (const table of PROJECT_TABLES) {
      result[table] = await fetchTable(table, orgId, table === 'projects' ? undefined : projectId)
      // For the projects table, filter by id instead of project_id
      if (table === 'projects') {
        result[table] = (result[table] as any[]).filter((r: any) => r.id === projectId)
      }
    }

    const timestamp = new Date().toISOString().slice(0, 10)

    if (format === 'json') {
      downloadBlob(
        JSON.stringify(result, null, 2),
        `project-export-${timestamp}.json`,
        'application/json'
      )
    } else {
      // CSV: combine all tables with a table_name column
      const allRows: Record<string, unknown>[] = []
      for (const [table, rows] of Object.entries(result)) {
        for (const row of rows as Record<string, unknown>[]) {
          allRows.push({ _table: table, ...row })
        }
      }
      downloadBlob(toCsv(allRows), `project-export-${timestamp}.csv`, 'text/csv')
    }

    return result
  },

  async exportOrganisation(orgId: string, format: 'json' | 'csv' = 'json') {
    const result: Record<string, unknown[]> = {}

    for (const table of ORG_TABLES) {
      result[table] = await fetchTable(table, orgId)
    }

    const timestamp = new Date().toISOString().slice(0, 10)

    if (format === 'json') {
      downloadBlob(
        JSON.stringify(result, null, 2),
        `org-export-${timestamp}.json`,
        'application/json'
      )
    } else {
      const allRows: Record<string, unknown>[] = []
      for (const [table, rows] of Object.entries(result)) {
        for (const row of rows as Record<string, unknown>[]) {
          allRows.push({ _table: table, ...row })
        }
      }
      downloadBlob(toCsv(allRows), `org-export-${timestamp}.csv`, 'text/csv')
    }

    return result
  },
}
