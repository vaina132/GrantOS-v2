import jsPDF from 'jspdf'
import { formatCurrency } from '@/lib/utils'
import type { Project, Person, TimesheetEntry, Proposal, CollabPartner, CollabProject, CollabWorkPackage, CollabTask, CollabDeliverable, CollabMilestone, CollabReportingPeriod, CollabReport } from '@/types'

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

export function generateStaffListPDF(staff: Person[], orgName: string) {
  const doc = setupDoc('Staff Directory', orgName)
  let y = 40

  // Summary
  y = addSectionTitle(doc, y, 'Overview')
  const active = staff.filter(p => p.is_active).length
  y = addKeyValue(doc, y, 'Total Staff', String(staff.length))
  y = addKeyValue(doc, y, 'Active', String(active))
  y = addKeyValue(doc, y, 'Inactive', String(staff.length - active))
  y += 6

  // Table
  y = checkPageBreak(doc, y, 40)
  y = addSectionTitle(doc, y, 'Staff List')

  const cols = [
    { label: 'Full Name', x: 14, width: 42 },
    { label: 'Email', x: 56, width: 44 },
    { label: 'Department', x: 100, width: 28 },
    { label: 'Role', x: 128, width: 24 },
    { label: 'FTE', x: 152, width: 14, align: 'right' as const },
    { label: 'Start Date', x: 166, width: 22, align: 'right' as const },
    { label: 'Status', x: 188, width: 8 },
  ]
  y = drawTableHeader(doc, y, cols)

  staff.forEach((p, i) => {
    y = checkPageBreak(doc, y)
    y = drawTableRow(doc, y, [
      { value: p.full_name, x: 14, width: 42, bold: true },
      { value: p.email ?? '—', x: 56, width: 44 },
      { value: p.department ?? '—', x: 100, width: 28 },
      { value: p.role ?? '—', x: 128, width: 24 },
      { value: p.fte != null ? String(p.fte) : '—', x: 152, width: 14, align: 'right' },
      { value: p.start_date ?? '—', x: 166, width: 22, align: 'right' },
      { value: p.is_active ? '✓' : '✗', x: 188, width: 8 },
    ], i % 2 === 1)
  })

  addFooter(doc)
  doc.save('staff_directory.pdf')
}

export function generateProjectsListPDF(projects: Project[], orgName: string) {
  const doc = setupDoc('Projects Overview', orgName)
  let y = 40

  // Summary
  y = addSectionTitle(doc, y, 'Overview')
  const statusCounts: Record<string, number> = {}
  let totalBudget = 0
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
    totalBudget += p.total_budget ?? 0
  }
  y = addKeyValue(doc, y, 'Total Projects', String(projects.length))
  y = addKeyValue(doc, y, 'Active', String(statusCounts['Active'] ?? 0))
  y = addKeyValue(doc, y, 'Upcoming', String(statusCounts['Upcoming'] ?? 0))
  y = addKeyValue(doc, y, 'Completed', String(statusCounts['Completed'] ?? 0))
  y = addKeyValue(doc, y, 'Total Budget', formatCurrency(totalBudget))
  y += 6

  // Table
  y = checkPageBreak(doc, y, 40)
  y = addSectionTitle(doc, y, 'All Projects')

  const cols = [
    { label: 'Acronym', x: 14, width: 24 },
    { label: 'Title', x: 38, width: 52 },
    { label: 'Status', x: 90, width: 22 },
    { label: 'Start', x: 112, width: 22 },
    { label: 'End', x: 134, width: 22 },
    { label: 'Grant #', x: 156, width: 20 },
    { label: 'Budget', x: 176, width: 20, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, cols)

  projects.forEach((p, i) => {
    y = checkPageBreak(doc, y)
    y = drawTableRow(doc, y, [
      { value: p.acronym, x: 14, width: 24, bold: true },
      { value: p.title, x: 38, width: 52 },
      { value: p.status, x: 90, width: 22 },
      { value: p.start_date ?? '—', x: 112, width: 22 },
      { value: p.end_date ?? '—', x: 134, width: 22 },
      { value: p.grant_number ?? '—', x: 156, width: 20 },
      { value: p.total_budget ? formatCurrency(p.total_budget) : '—', x: 176, width: 20, align: 'right' },
    ], i % 2 === 1)
  })

  addFooter(doc)
  doc.save('projects_overview.pdf')
}

export function generateCollabBudgetPDF(
  acronym: string,
  partners: CollabPartner[],
  orgName: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header band (landscape = 297mm wide)
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, 297, 28, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('GrantLume', 14, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Collaboration Budget Overview — ${acronym}`, 14, 22)
  doc.setFontSize(9)
  doc.text(orgName, 297 - 14, 22, { align: 'right' })
  doc.setTextColor(...MUTED)
  doc.setFontSize(8)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 297 - 14, 14, { align: 'right' })

  let y = 38

  // Summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text('Budget Summary', 14, y)
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(14, y + 2, 80, y + 2)
  y += 10

  const totalDirect = partners.reduce((s, p) => s + p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods, 0)
  y = addKeyValue(doc, y, 'Partners', String(partners.length))
  y = addKeyValue(doc, y, 'Total Direct Costs', `€${totalDirect.toLocaleString()}`)
  y = addKeyValue(doc, y, 'Total PMs', partners.reduce((s, p) => s + p.total_person_months, 0).toFixed(1))
  y += 8

  // Budget table
  const cols = [
    { label: 'Partner', x: 14, width: 42 },
    { label: 'Country', x: 56, width: 18 },
    { label: 'Personnel', x: 74, width: 24, align: 'right' as const },
    { label: 'Subcontr.', x: 98, width: 24, align: 'right' as const },
    { label: 'Travel', x: 122, width: 22, align: 'right' as const },
    { label: 'Equipment', x: 144, width: 24, align: 'right' as const },
    { label: 'Other', x: 168, width: 22, align: 'right' as const },
    { label: 'Direct', x: 190, width: 24, align: 'right' as const },
    { label: 'Indirect', x: 214, width: 22, align: 'right' as const },
    { label: 'Grand Total', x: 236, width: 26, align: 'right' as const },
    { label: 'Funding', x: 262, width: 22, align: 'right' as const },
  ]

  // Header background (landscape)
  doc.setFillColor(...LIGHT_BG)
  doc.rect(14, y - 4, 270, 8, 'F')
  doc.setDrawColor(...BORDER)
  doc.line(14, y + 4, 284, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  for (const col of cols) {
    if (col.align === 'right') {
      doc.text(col.label, col.x + col.width, y, { align: 'right' })
    } else {
      doc.text(col.label, col.x, y)
    }
  }
  y += 8

  // Rows
  const fmt = (n: number) => `€${Math.round(n).toLocaleString()}`

  let totals = { personnel: 0, subcontracting: 0, travel: 0, equipment: 0, other: 0, direct: 0, indirect: 0, grand: 0, funding: 0 }

  partners.forEach((p, i) => {
    const direct = p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
    const indirectBase = p.indirect_cost_base === 'personnel_only'
      ? p.budget_personnel
      : p.indirect_cost_base === 'all_except_subcontracting'
        ? direct - p.budget_subcontracting
        : direct
    const indirect = indirectBase * (p.indirect_cost_rate / 100)
    const grand = direct + indirect
    const funding = grand * (p.funding_rate / 100)

    totals.personnel += p.budget_personnel
    totals.subcontracting += p.budget_subcontracting
    totals.travel += p.budget_travel
    totals.equipment += p.budget_equipment
    totals.other += p.budget_other_goods
    totals.direct += direct
    totals.indirect += indirect
    totals.grand += grand
    totals.funding += funding

    if (y > 190) { doc.addPage(); y = 20 }

    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 253)
      doc.rect(14, y - 3.5, 270, 7, 'F')
    }

    const label = p.role === 'coordinator' ? `[C] ${p.org_name}` : `#${p.participant_number} ${p.org_name}`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...DARK)
    const truncLabel = label.length > 24 ? label.slice(0, 21) + '...' : label
    doc.text(truncLabel, 14, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(p.country || '—', 56, y)

    const vals = [
      { v: fmt(p.budget_personnel), x: 74, w: 24 },
      { v: fmt(p.budget_subcontracting), x: 98, w: 24 },
      { v: fmt(p.budget_travel), x: 122, w: 22 },
      { v: fmt(p.budget_equipment), x: 144, w: 24 },
      { v: fmt(p.budget_other_goods), x: 168, w: 22 },
      { v: fmt(direct), x: 190, w: 24 },
      { v: fmt(indirect), x: 214, w: 22 },
      { v: fmt(grand), x: 236, w: 26 },
      { v: fmt(funding), x: 262, w: 22 },
    ]
    for (const v of vals) {
      doc.text(v.v, v.x + v.w, y, { align: 'right' })
    }

    y += 7
  })

  // Totals row
  y += 2
  doc.setDrawColor(...BORDER)
  doc.line(14, y - 1, 284, y - 1)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text('Total', 14, y)
  doc.text('', 56, y)
  const totalVals = [
    { v: fmt(totals.personnel), x: 74, w: 24 },
    { v: fmt(totals.subcontracting), x: 98, w: 24 },
    { v: fmt(totals.travel), x: 122, w: 22 },
    { v: fmt(totals.equipment), x: 144, w: 24 },
    { v: fmt(totals.other), x: 168, w: 22 },
    { v: fmt(totals.direct), x: 190, w: 24 },
    { v: fmt(Math.round(totals.indirect)), x: 214, w: 22 },
    { v: fmt(Math.round(totals.grand)), x: 236, w: 26 },
    { v: fmt(Math.round(totals.funding)), x: 262, w: 22 },
  ]
  for (const v of totalVals) {
    doc.text(v.v, v.x + v.w, y, { align: 'right' })
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BORDER)
    doc.line(14, 200, 283, 200)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('GrantLume — Grant & Project Management', 14, 205)
    doc.text(`Page ${i} of ${pageCount}`, 283, 205, { align: 'right' })
  }

  doc.save(`${acronym}_budget_overview.pdf`)
}

// ════════════════════════════════════════════════════════════════════════════
// Collab: EC Periodic Technical Report
// ════════════════════════════════════════════════════════════════════════════

export function generateCollabPeriodicReportPDF(
  project: CollabProject,
  partners: CollabPartner[],
  wps: CollabWorkPackage[],
  tasksByWp: Record<string, CollabTask[]>,
  deliverables: CollabDeliverable[],
  milestones: CollabMilestone[],
  period: CollabReportingPeriod,
  reports: CollabReport[],
) {
  const doc = setupDoc(`Periodic Technical Report — ${period.title}`, project.acronym)
  let y = 36

  // Project identity
  y = addSectionTitle(doc, y, '1. Project Information')
  y = addKeyValue(doc, y, 'Project Acronym', project.acronym)
  y = addKeyValue(doc, y, 'Project Title', project.title)
  if (project.grant_number) y = addKeyValue(doc, y, 'Grant Agreement', project.grant_number)
  if (project.funding_programme) y = addKeyValue(doc, y, 'Programme', project.funding_programme)
  y = addKeyValue(doc, y, 'Reporting Period', `${period.title} (M${period.start_month}–M${period.end_month})`)
  if (period.due_date) y = addKeyValue(doc, y, 'Due Date', period.due_date)
  y = addKeyValue(doc, y, 'Partners', String(partners.length))
  const coord = partners.find(p => p.role === 'coordinator')
  if (coord) y = addKeyValue(doc, y, 'Coordinator', coord.org_name)
  y += 4

  // Consortium
  y = addSectionTitle(doc, y, '2. Consortium Overview')
  const consortiumCols = [
    { label: '#', x: 14, width: 10 },
    { label: 'Organisation', x: 24, width: 50 },
    { label: 'Country', x: 74, width: 20 },
    { label: 'Role', x: 94, width: 25 },
    { label: 'PMs', x: 119, width: 20, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, consortiumCols)
  partners.forEach((p, i) => {
    if (y > 270) { doc.addPage(); y = 20 }
    y = drawTableRow(doc, y, [
      { value: String(p.participant_number ?? i + 1), x: 14, width: 10 },
      { value: p.org_name, x: 24, width: 50 },
      { value: p.country || '—', x: 74, width: 20 },
      { value: p.role, x: 94, width: 25 },
      { value: p.total_person_months.toFixed(1), x: 119, width: 20, align: 'right' },
    ], i % 2 === 1)
  })
  y += 6

  // Work Package Progress
  if (y > 240) { doc.addPage(); y = 20 }
  y = addSectionTitle(doc, y, '3. Work Package Progress')
  for (const wp of wps) {
    if (y > 255) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text(`WP${wp.wp_number}: ${wp.title}`, 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    const wpMeta: string[] = []
    if (wp.start_month != null && wp.end_month != null) wpMeta.push(`M${wp.start_month}–M${wp.end_month}`)
    wpMeta.push(`${wp.total_person_months} PMs`)
    const tasks = tasksByWp[wp.id] ?? []
    if (tasks.length > 0) wpMeta.push(`${tasks.length} task(s)`)
    doc.text(wpMeta.join(' · '), 14, y)
    y += 5

    if (tasks.length > 0) {
      for (const tk of tasks) {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.setTextColor(...DARK)
        doc.setFontSize(7)
        doc.text(`  ${tk.task_number}: ${tk.title}`, 18, y)
        if (tk.start_month != null && tk.end_month != null) {
          doc.setTextColor(...MUTED)
          doc.text(`M${tk.start_month}–M${tk.end_month}`, 120, y)
        }
        y += 4
      }
    }
    y += 3
  }

  // Deliverables
  if (y > 230) { doc.addPage(); y = 20 }
  y = addSectionTitle(doc, y, '4. Deliverables')
  const periodDels = deliverables.filter(d => d.due_month >= period.start_month && d.due_month <= period.end_month)
  if (periodDels.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('No deliverables due in this reporting period.', 14, y)
    y += 6
  } else {
    const delCols = [
      { label: '#', x: 14, width: 15 },
      { label: 'Title', x: 29, width: 70 },
      { label: 'WP', x: 99, width: 15 },
      { label: 'Type', x: 114, width: 25 },
      { label: 'Due', x: 139, width: 15 },
      { label: 'Lead', x: 154, width: 40 },
    ]
    y = drawTableHeader(doc, y, delCols)
    periodDels.forEach((d, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      const wp = d.wp_id ? wps.find(w => w.id === d.wp_id) : null
      const leader = d.leader_partner_id ? partners.find(p => p.id === d.leader_partner_id) : null
      y = drawTableRow(doc, y, [
        { value: d.number, x: 14, width: 15 },
        { value: d.title, x: 29, width: 70 },
        { value: wp ? `WP${wp.wp_number}` : '—', x: 99, width: 15 },
        { value: d.type || '—', x: 114, width: 25 },
        { value: `M${d.due_month}`, x: 139, width: 15 },
        { value: leader?.org_name ?? '—', x: 154, width: 40 },
      ], i % 2 === 1)
    })
    y += 6
  }

  // Milestones
  if (y > 230) { doc.addPage(); y = 20 }
  y = addSectionTitle(doc, y, '5. Milestones')
  const periodMs = milestones.filter(m => m.due_month >= period.start_month && m.due_month <= period.end_month)
  if (periodMs.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('No milestones due in this reporting period.', 14, y)
    y += 6
  } else {
    const msCols = [
      { label: '#', x: 14, width: 15 },
      { label: 'Title', x: 29, width: 70 },
      { label: 'WP', x: 99, width: 15 },
      { label: 'Due', x: 114, width: 15 },
      { label: 'Verification', x: 129, width: 65 },
    ]
    y = drawTableHeader(doc, y, msCols)
    periodMs.forEach((m, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      const wp = m.wp_id ? wps.find(w => w.id === m.wp_id) : null
      y = drawTableRow(doc, y, [
        { value: m.number, x: 14, width: 15 },
        { value: m.title, x: 29, width: 70 },
        { value: wp ? `WP${wp.wp_number}` : '—', x: 99, width: 15 },
        { value: `M${m.due_month}`, x: 114, width: 15 },
        { value: m.verification_means || '—', x: 129, width: 65 },
      ], i % 2 === 1)
    })
    y += 6
  }

  // Partner report status
  if (reports.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y = addSectionTitle(doc, y, '6. Partner Financial Report Status')
    const rpCols = [
      { label: 'Partner', x: 14, width: 60 },
      { label: 'Status', x: 74, width: 30 },
      { label: 'Submitted', x: 104, width: 35 },
      { label: 'Reviewed', x: 139, width: 35 },
    ]
    y = drawTableHeader(doc, y, rpCols)
    reports.forEach((r, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      const rPartner = r.partner ?? partners.find(p => p.id === r.partner_id)
      y = drawTableRow(doc, y, [
        { value: rPartner?.org_name ?? '—', x: 14, width: 60 },
        { value: r.status, x: 74, width: 30 },
        { value: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—', x: 104, width: 35 },
        { value: r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '—', x: 139, width: 35 },
      ], i % 2 === 1)
    })
  }

  // Footer
  addFooter(doc)
  doc.save(`${project.acronym}_periodic_report_${period.title.replace(/\s/g, '_')}.pdf`)
}

// ════════════════════════════════════════════════════════════════════════════
// Collab: Financial Statement (Form C style)
// ════════════════════════════════════════════════════════════════════════════

export function generateCollabFinancialStatementPDF(
  project: CollabProject,
  partners: CollabPartner[],
  period: CollabReportingPeriod,
  reports: CollabReport[],
) {
  const doc = setupDoc(`Financial Statement — ${period.title}`, project.acronym)
  let y = 36

  y = addSectionTitle(doc, y, '1. Project & Period')
  y = addKeyValue(doc, y, 'Project', `${project.acronym} — ${project.title}`)
  if (project.grant_number) y = addKeyValue(doc, y, 'Grant Agreement', project.grant_number)
  y = addKeyValue(doc, y, 'Period', `${period.title} (M${period.start_month}–M${period.end_month})`)
  y += 6

  // Budget overview per partner
  y = addSectionTitle(doc, y, '2. Planned Budget by Partner')
  const budCols = [
    { label: 'Partner', x: 14, width: 40 },
    { label: 'Personnel', x: 54, width: 22, align: 'right' as const },
    { label: 'Subcontract', x: 76, width: 22, align: 'right' as const },
    { label: 'Travel', x: 98, width: 20, align: 'right' as const },
    { label: 'Equipment', x: 118, width: 22, align: 'right' as const },
    { label: 'Other', x: 140, width: 20, align: 'right' as const },
    { label: 'Total', x: 160, width: 22, align: 'right' as const },
    { label: 'Indirect', x: 182, width: 20, align: 'right' as const },
  ]
  y = drawTableHeader(doc, y, budCols)

  const fmt = (n: number) => `€${Math.round(n).toLocaleString()}`
  const totals = { pers: 0, sub: 0, trav: 0, equip: 0, other: 0, direct: 0, indirect: 0 }

  partners.forEach((p, i) => {
    if (y > 270) { doc.addPage(); y = 20 }
    const direct = p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
    const indirectBase = p.indirect_cost_base === 'personnel_only'
      ? p.budget_personnel
      : p.indirect_cost_base === 'all_except_subcontracting'
        ? direct - p.budget_subcontracting
        : direct
    const indirect = indirectBase * (p.indirect_cost_rate / 100)
    totals.pers += p.budget_personnel
    totals.sub += p.budget_subcontracting
    totals.trav += p.budget_travel
    totals.equip += p.budget_equipment
    totals.other += p.budget_other_goods
    totals.direct += direct
    totals.indirect += indirect

    y = drawTableRow(doc, y, [
      { value: p.org_name, x: 14, width: 40, bold: p.role === 'coordinator' },
      { value: fmt(p.budget_personnel), x: 54, width: 22, align: 'right' },
      { value: fmt(p.budget_subcontracting), x: 76, width: 22, align: 'right' },
      { value: fmt(p.budget_travel), x: 98, width: 20, align: 'right' },
      { value: fmt(p.budget_equipment), x: 118, width: 22, align: 'right' },
      { value: fmt(p.budget_other_goods), x: 140, width: 20, align: 'right' },
      { value: fmt(direct), x: 160, width: 22, align: 'right', bold: true },
      { value: fmt(indirect), x: 182, width: 20, align: 'right' },
    ], i % 2 === 1)
  })

  // Total row
  y += 2
  doc.setDrawColor(...BORDER)
  doc.line(14, y - 1, 202, y - 1)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text('Total', 14, y + 1)
  const totalRowVals = [
    { v: fmt(totals.pers), x: 54, w: 22 },
    { v: fmt(totals.sub), x: 76, w: 22 },
    { v: fmt(totals.trav), x: 98, w: 20 },
    { v: fmt(totals.equip), x: 118, w: 22 },
    { v: fmt(totals.other), x: 140, w: 20 },
    { v: fmt(totals.direct), x: 160, w: 22 },
    { v: fmt(Math.round(totals.indirect)), x: 182, w: 20 },
  ]
  for (const v of totalRowVals) {
    doc.text(v.v, v.x + v.w, y + 1, { align: 'right' })
  }
  y += 10

  // Report statuses
  if (reports.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y = addSectionTitle(doc, y, '3. Partner Report Status')
    const statusCols = [
      { label: 'Partner', x: 14, width: 50 },
      { label: 'Status', x: 64, width: 25 },
      { label: 'Submitted', x: 89, width: 30 },
      { label: 'Reviewed', x: 119, width: 30 },
    ]
    y = drawTableHeader(doc, y, statusCols)
    reports.forEach((r, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      const rPartner = r.partner ?? partners.find(p => p.id === r.partner_id)
      y = drawTableRow(doc, y, [
        { value: rPartner?.org_name ?? '—', x: 14, width: 50 },
        { value: r.status.charAt(0).toUpperCase() + r.status.slice(1), x: 64, width: 25, bold: r.status === 'approved' },
        { value: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—', x: 89, width: 30 },
        { value: r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '—', x: 119, width: 30 },
      ], i % 2 === 1)
    })
  }

  addFooter(doc)
  doc.save(`${project.acronym}_financial_statement_${period.title.replace(/\s/g, '_')}.pdf`)
}

// ════════════════════════════════════════════════════════════════════════════
// Collab: Publishable Summary
// ════════════════════════════════════════════════════════════════════════════

export function generateCollabPublishableSummaryPDF(
  project: CollabProject,
  partners: CollabPartner[],
  wps: CollabWorkPackage[],
  deliverables: CollabDeliverable[],
  milestones: CollabMilestone[],
) {
  const doc = setupDoc('Publishable Summary', project.acronym)
  let y = 36

  // Project overview
  y = addSectionTitle(doc, y, '1. Project Overview')
  y = addKeyValue(doc, y, 'Acronym', project.acronym)
  y = addKeyValue(doc, y, 'Title', project.title)
  if (project.grant_number) y = addKeyValue(doc, y, 'Grant Agreement', project.grant_number)
  if (project.funding_programme) y = addKeyValue(doc, y, 'Programme', project.funding_programme)
  if (project.funding_scheme) y = addKeyValue(doc, y, 'Scheme', project.funding_scheme)
  if (project.start_date && project.end_date) y = addKeyValue(doc, y, 'Duration', `${project.start_date} → ${project.end_date} (${project.duration_months ?? '?'} months)`)
  y += 4

  // Consortium
  y = addSectionTitle(doc, y, '2. Consortium')
  partners.forEach((p, i) => {
    if (y > 270) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', i === 0 || p.role === 'coordinator' ? 'bold' : 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    const label = `${p.participant_number ?? i + 1}. ${p.org_name}`
    const meta = [p.country, p.role === 'coordinator' ? 'Coordinator' : 'Partner'].filter(Boolean).join(' — ')
    doc.text(label, 14, y)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.text(meta, 100, y)
    y += 5
  })
  y += 4

  // Work Plan
  if (y > 240) { doc.addPage(); y = 20 }
  y = addSectionTitle(doc, y, '3. Work Plan')
  wps.forEach((wp) => {
    if (y > 265) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    doc.text(`WP${wp.wp_number}: ${wp.title}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    const meta = []
    if (wp.start_month != null && wp.end_month != null) meta.push(`M${wp.start_month}–M${wp.end_month}`)
    meta.push(`${wp.total_person_months} PMs`)
    doc.text(meta.join(' · '), 120, y)
    y += 5
  })
  y += 4

  // Key deliverables
  if (deliverables.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y = addSectionTitle(doc, y, '4. Key Deliverables')
    deliverables.forEach((d) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text(`${d.number}: ${d.title}`, 14, y)
      doc.setTextColor(...MUTED)
      doc.text(`M${d.due_month}`, 160, y)
      if (d.type) doc.text(d.type, 175, y)
      y += 5
    })
    y += 4
  }

  // Key milestones
  if (milestones.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y = addSectionTitle(doc, y, '5. Key Milestones')
    milestones.forEach((m) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text(`${m.number}: ${m.title}`, 14, y)
      doc.setTextColor(...MUTED)
      doc.text(`M${m.due_month}`, 160, y)
      y += 5
    })
    y += 4
  }

  // Budget summary
  if (y > 240) { doc.addPage(); y = 20 }
  y = addSectionTitle(doc, y, `${deliverables.length > 0 && milestones.length > 0 ? '6' : deliverables.length > 0 || milestones.length > 0 ? '5' : '4'}. Budget Summary`)
  const totalBudget = partners.reduce((sum, p) => {
    const direct = p.budget_personnel + p.budget_subcontracting + p.budget_travel + p.budget_equipment + p.budget_other_goods
    const indirectBase = p.indirect_cost_base === 'personnel_only'
      ? p.budget_personnel
      : p.indirect_cost_base === 'all_except_subcontracting'
        ? direct - p.budget_subcontracting
        : direct
    return sum + direct + indirectBase * (p.indirect_cost_rate / 100)
  }, 0)
  const totalPMs = partners.reduce((sum, p) => sum + p.total_person_months, 0)
  y = addKeyValue(doc, y, 'Total Budget', `€${Math.round(totalBudget).toLocaleString()}`)
  y = addKeyValue(doc, y, 'Total Person-Months', totalPMs.toFixed(1))
  y = addKeyValue(doc, y, 'Partners', String(partners.length))

  addFooter(doc)
  doc.save(`${project.acronym}_publishable_summary.pdf`)
}


