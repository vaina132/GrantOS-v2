import jsPDF from 'jspdf'
import { formatCurrency } from '@/lib/utils'
import type { Project, Person, TimesheetEntry, Proposal } from '@/types'

// Brand colors
const PRIMARY = [37, 99, 235] as const   // blue-600
const DARK = [15, 23, 42] as const       // slate-900
const MUTED = [100, 116, 139] as const   // slate-500
const LIGHT_BG = [248, 250, 252] as const // slate-50
const WHITE = [255, 255, 255] as const
const BORDER = [226, 232, 240] as const  // slate-200

function setupDoc(title: string, subtitle?: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header band
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('GrantLume', 14, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 22)

  if (subtitle) {
    doc.setTextColor(...WHITE)
    doc.setFontSize(9)
    doc.text(subtitle, 210 - 14, 22, { align: 'right' })
  }

  // Generated date
  doc.setTextColor(...MUTED)
  doc.setFontSize(8)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 210 - 14, 14, { align: 'right' })

  return doc
}

function addSectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text(text, 14, y)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(14, y + 2, 80, y + 2)
  return y + 10
}

function addKeyValue(doc: jsPDF, y: number, label: string, value: string, x = 14): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(label, x, y)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.text(value, x + 45, y)
  return y + 6
}

function drawTableHeader(doc: jsPDF, y: number, columns: { label: string; x: number; width: number; align?: 'left' | 'right' }[]): number {
  doc.setFillColor(...LIGHT_BG)
  doc.rect(14, y - 4, 182, 8, 'F')
  doc.setDrawColor(...BORDER)
  doc.line(14, y + 4, 196, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)

  for (const col of columns) {
    if (col.align === 'right') {
      doc.text(col.label, col.x + col.width, y, { align: 'right' })
    } else {
      doc.text(col.label, col.x, y)
    }
  }

  return y + 8
}

function drawTableRow(doc: jsPDF, y: number, columns: { value: string; x: number; width: number; align?: 'left' | 'right'; bold?: boolean }[], stripe: boolean): number {
  if (stripe) {
    doc.setFillColor(252, 252, 253)
    doc.rect(14, y - 3.5, 182, 7, 'F')
  }

  doc.setFontSize(8)
  doc.setTextColor(...DARK)

  for (const col of columns) {
    doc.setFont('helvetica', col.bold ? 'bold' : 'normal')
    const text = col.value.length > 40 ? col.value.slice(0, 37) + '...' : col.value
    if (col.align === 'right') {
      doc.text(text, col.x + col.width, y, { align: 'right' })
    } else {
      doc.text(text, col.x, y)
    }
  }

  return y + 7
}

function checkPageBreak(doc: jsPDF, y: number, needed = 20): number {
  if (y > 270 - needed) {
    doc.addPage()
    return 20
  }
  return y
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BORDER)
    doc.line(14, 285, 196, 285)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('GrantLume — Grant & Project Management', 14, 290)
    doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: 'right' })
  }
}

// ==========================================
// PUBLIC REPORT GENERATORS
// ==========================================

export function generateProjectSummaryPDF(
  project: Project,
  staff: Person[],
  assignments: { person_id: string; pms: number }[],
  orgName: string,
) {
  const doc = setupDoc('Project Summary Report', orgName)
  let y = 40

  // Project Details
  y = addSectionTitle(doc, y, 'Project Details')
  y = addKeyValue(doc, y, 'Acronym', project.acronym)
  y = addKeyValue(doc, y, 'Title', project.title)
  y = addKeyValue(doc, y, 'Status', project.status)
  y = addKeyValue(doc, y, 'Start Date', new Date(project.start_date).toLocaleDateString('en-GB'))
  y = addKeyValue(doc, y, 'End Date', new Date(project.end_date).toLocaleDateString('en-GB'))
  if (project.funding_schemes?.name) y = addKeyValue(doc, y, 'Programme', project.funding_schemes.name)
  if (project.grant_number) y = addKeyValue(doc, y, 'Grant No.', project.grant_number)
  y = addKeyValue(doc, y, 'Total Budget', formatCurrency(project.total_budget ?? 0))
  y += 6

  // Personnel Allocations
  const projectAssignments = assignments.filter((a) => a.pms > 0)
  if (projectAssignments.length > 0) {
    y = checkPageBreak(doc, y, 40)
    y = addSectionTitle(doc, y, 'Personnel Allocations')

    const cols = [
      { label: 'Person', x: 14, width: 80 },
      { label: 'Department', x: 94, width: 50 },
      { label: 'PMs', x: 144, width: 30, align: 'right' as const },
    ]
    y = drawTableHeader(doc, y, cols)

    const personMap = new Map(staff.map((s) => [s.id, s]))
    const grouped = new Map<string, number>()
    for (const a of projectAssignments) {
      grouped.set(a.person_id, (grouped.get(a.person_id) ?? 0) + a.pms)
    }

    let i = 0
    for (const [personId, totalPms] of grouped) {
      y = checkPageBreak(doc, y)
      const person = personMap.get(personId)
      y = drawTableRow(doc, y, [
        { value: person?.full_name ?? 'Unknown', x: 14, width: 80, bold: true },
        { value: person?.department ?? '—', x: 94, width: 50 },
        { value: totalPms.toFixed(2), x: 144, width: 30, align: 'right' },
      ], i % 2 === 1)
      i++
    }

    // Total row
    y += 2
    doc.setDrawColor(...BORDER)
    doc.line(14, y - 1, 196, y - 1)
    y = drawTableRow(doc, y, [
      { value: 'Total', x: 14, width: 80, bold: true },
      { value: '', x: 94, width: 50 },
      { value: Array.from(grouped.values()).reduce((s, v) => s + v, 0).toFixed(2), x: 144, width: 30, align: 'right', bold: true },
    ], false)
  }

  addFooter(doc)
  doc.save(`${project.acronym}_summary.pdf`)
}

export function generateFinancialReportPDF(
  projects: Project[],
  expenses: { project_id: string; category: string; amount: number; description: string; date: string }[],
  orgName: string,
) {
  const doc = setupDoc('Financial Report', orgName)
  let y = 40

  // Budget Overview
  y = addSectionTitle(doc, y, 'Budget Overview by Project')

  const cols = [
    { label: 'Project', x: 14, width: 45 },
    { label: 'Status', x: 59, width: 25 },
    { label: 'Budget', x: 84, width: 30, align: 'right' as const },
    { label: 'Spent', x: 114, width: 30, align: 'right' as const },
    { label: 'Remaining', x: 144, width: 30, align: 'right' as const },
    { label: 'Utilisation', x: 174, width: 22, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, cols)

  let totalBudget = 0
  let totalSpent = 0

  projects.forEach((p, i) => {
    y = checkPageBreak(doc, y)
    const projectExpenses = expenses.filter((e) => e.project_id === p.id)
    const spent = projectExpenses.reduce((sum, e) => sum + e.amount, 0)
    const budget = p.total_budget ?? 0
    const remaining = budget - spent
    const utilisation = budget > 0 ? ((spent / budget) * 100).toFixed(0) + '%' : '—'

    totalBudget += budget
    totalSpent += spent

    y = drawTableRow(doc, y, [
      { value: p.acronym, x: 14, width: 45, bold: true },
      { value: p.status, x: 59, width: 25 },
      { value: formatCurrency(budget), x: 84, width: 30, align: 'right' },
      { value: formatCurrency(spent), x: 114, width: 30, align: 'right' },
      { value: formatCurrency(remaining), x: 144, width: 30, align: 'right' },
      { value: utilisation, x: 174, width: 22, align: 'right' },
    ], i % 2 === 1)
  })

  // Totals
  y += 2
  doc.setDrawColor(...BORDER)
  doc.line(14, y - 1, 196, y - 1)
  y = drawTableRow(doc, y, [
    { value: 'Total', x: 14, width: 45, bold: true },
    { value: '', x: 59, width: 25 },
    { value: formatCurrency(totalBudget), x: 84, width: 30, align: 'right', bold: true },
    { value: formatCurrency(totalSpent), x: 114, width: 30, align: 'right', bold: true },
    { value: formatCurrency(totalBudget - totalSpent), x: 144, width: 30, align: 'right', bold: true },
    { value: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) + '%' : '—', x: 174, width: 22, align: 'right', bold: true },
  ], false)

  // Expense breakdown by category
  if (expenses.length > 0) {
    y += 10
    y = checkPageBreak(doc, y, 40)
    y = addSectionTitle(doc, y, 'Expenses by Category')

    const catTotals = new Map<string, number>()
    for (const e of expenses) {
      catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + e.amount)
    }

    const catCols = [
      { label: 'Category', x: 14, width: 80 },
      { label: 'Total', x: 94, width: 40, align: 'right' as const },
      { label: '% of Total', x: 134, width: 30, align: 'right' as const },
    ]
    y = drawTableHeader(doc, y, catCols)

    let ci = 0
    for (const [cat, total] of catTotals) {
      y = checkPageBreak(doc, y)
      const pct = totalSpent > 0 ? ((total / totalSpent) * 100).toFixed(1) + '%' : '—'
      y = drawTableRow(doc, y, [
        { value: cat.charAt(0).toUpperCase() + cat.slice(1), x: 14, width: 80, bold: true },
        { value: formatCurrency(total), x: 94, width: 40, align: 'right' },
        { value: pct, x: 134, width: 30, align: 'right' },
      ], ci % 2 === 1)
      ci++
    }
  }

  addFooter(doc)
  doc.save('financial_report.pdf')
}

export function generateTimesheetReportPDF(
  entries: TimesheetEntry[],
  staff: Person[],
  _projects: Project[],
  year: number,
  orgName: string,
) {
  const doc = setupDoc(`Timesheet Report — ${year}`, orgName)
  let y = 40

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Summary by person
  y = addSectionTitle(doc, y, 'Summary by Person')

  const personMap = new Map(staff.map((s) => [s.id, s]))
  // Group entries by person
  const byPerson = new Map<string, TimesheetEntry[]>()
  for (const e of entries) {
    const arr = byPerson.get(e.person_id) ?? []
    arr.push(e)
    byPerson.set(e.person_id, arr)
  }

  const cols = [
    { label: 'Person', x: 14, width: 50 },
    { label: 'Entries', x: 64, width: 20, align: 'right' as const },
    { label: 'Submitted', x: 84, width: 25, align: 'right' as const },
    { label: 'Approved', x: 109, width: 25, align: 'right' as const },
    { label: 'Total PMs', x: 134, width: 30, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, cols)

  let idx = 0
  for (const [personId, personEntries] of byPerson) {
    y = checkPageBreak(doc, y)
    const person = personMap.get(personId)
    const submitted = personEntries.filter((e) => e.status === 'Submitted' || e.status === 'Approved').length
    const approved = personEntries.filter((e) => e.status === 'Approved').length
    const totalPms = personEntries.reduce((sum, e) => sum + (e.total_hours ?? 0), 0)

    y = drawTableRow(doc, y, [
      { value: person?.full_name ?? 'Unknown', x: 14, width: 50, bold: true },
      { value: String(personEntries.length), x: 64, width: 20, align: 'right' },
      { value: String(submitted), x: 84, width: 25, align: 'right' },
      { value: String(approved), x: 109, width: 25, align: 'right' },
      { value: totalPms.toFixed(2), x: 134, width: 30, align: 'right' },
    ], idx % 2 === 1)
    idx++
  }

  // Monthly breakdown
  y += 10
  y = checkPageBreak(doc, y, 40)
  y = addSectionTitle(doc, y, 'Monthly Breakdown')

  const monthlyCols = [
    { label: 'Month', x: 14, width: 30 },
    { label: 'Entries', x: 44, width: 25, align: 'right' as const },
    { label: 'Total PMs', x: 69, width: 30, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, monthlyCols)

  for (let m = 1; m <= 12; m++) {
    y = checkPageBreak(doc, y)
    const monthEntries = entries.filter((e) => e.month === m)
    const monthPms = monthEntries.reduce((sum, e) => sum + (e.total_hours ?? 0), 0)
    y = drawTableRow(doc, y, [
      { value: `${MONTHS[m - 1]} ${year}`, x: 14, width: 30, bold: true },
      { value: String(monthEntries.length), x: 44, width: 25, align: 'right' },
      { value: monthPms.toFixed(2), x: 69, width: 30, align: 'right' },
    ], m % 2 === 0)
  }

  addFooter(doc)
  doc.save(`timesheet_report_${year}.pdf`)
}

export function generateProposalsPipelinePDF(proposals: Proposal[], orgName: string) {
  const doc = setupDoc('Proposals Pipeline Report', orgName)
  let y = 40

  // Summary stats
  y = addSectionTitle(doc, y, 'Pipeline Overview')
  const statusCounts: Record<string, number> = {}
  let totalBudget = 0
  for (const p of proposals) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
    totalBudget += p.personnel_budget + p.travel_budget + p.subcontracting_budget + p.other_budget
  }
  y = addKeyValue(doc, y, 'Total Proposals', String(proposals.length))
  y = addKeyValue(doc, y, 'In Preparation', String(statusCounts['In Preparation'] ?? 0))
  y = addKeyValue(doc, y, 'Submitted', String(statusCounts['Submitted'] ?? 0))
  y = addKeyValue(doc, y, 'Granted', String(statusCounts['Granted'] ?? 0))
  y = addKeyValue(doc, y, 'Rejected', String(statusCounts['Rejected'] ?? 0))
  y = addKeyValue(doc, y, 'Total Pipeline Value', formatCurrency(totalBudget))
  y += 6

  // Proposals table
  y = checkPageBreak(doc, y, 40)
  y = addSectionTitle(doc, y, 'All Proposals')

  const cols = [
    { label: 'Project Name', x: 14, width: 50 },
    { label: 'Call', x: 64, width: 40 },
    { label: 'Status', x: 104, width: 25 },
    { label: 'PMs', x: 129, width: 15, align: 'right' as const },
    { label: 'Budget', x: 144, width: 30, align: 'right' as const },
    { label: 'Deadline', x: 174, width: 22, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, cols)

  proposals.forEach((p, i) => {
    y = checkPageBreak(doc, y)
    const total = p.personnel_budget + p.travel_budget + p.subcontracting_budget + p.other_budget
    const deadline = p.submission_deadline
      ? new Date(p.submission_deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      : '—'
    y = drawTableRow(doc, y, [
      { value: p.project_name, x: 14, width: 50, bold: true },
      { value: p.call_identifier || '—', x: 64, width: 40 },
      { value: p.status, x: 104, width: 25 },
      { value: p.our_pms > 0 ? String(p.our_pms) : '—', x: 129, width: 15, align: 'right' },
      { value: total > 0 ? formatCurrency(total) : '—', x: 144, width: 30, align: 'right' },
      { value: deadline, x: 174, width: 22, align: 'right' },
    ], i % 2 === 1)
  })

  addFooter(doc)
  doc.save('proposals_pipeline.pdf')
}
