import * as XLSX from 'xlsx'

interface ExportColumn<T> {
  header: string
  accessor: (row: T) => unknown
}

/**
 * Export an array of data to an Excel (.xlsx) file.
 * @param data - The rows to export
 * @param columns - Column definitions with header labels and accessor functions
 * @param filename - Output filename (without extension)
 * @param sheetName - Optional sheet name (defaults to 'Data')
 */
export function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Data',
) {
  const headers = columns.map((c) => c.header)
  const rows = data.map((row) => columns.map((c) => c.accessor(row)))

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
