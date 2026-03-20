import jsPDF from 'jspdf'
import { hoursToPm, formatPm, getWorkingDaysInMonth } from '@/lib/pmUtils'
import type { Person, Project, TimesheetDay, TimesheetEntry } from '@/types'

// Brand colors
const PRIMARY = [37, 99, 235] as const
const DARK = [15, 23, 42] as const
const MUTED = [100, 116, 139] as const
const LIGHT_BG = [248, 250, 252] as const
const WHITE = [255, 255, 255] as const
const BORDER = [226, 232, 240] as const
const AMBER = [180, 83, 9] as const

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface TimesheetPdfData {
  person: Person
  year: number
  month: number
  orgName: string
  days: TimesheetDay[]
  projects: Project[]
  envelope: TimesheetEntry | null
  hoursPerDay: number
  holidays: Set<string>
  absences: Set<string>
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function generateTimesheetPdf(data: TimesheetPdfData): void {
  const { person, year, month, orgName, days, projects, envelope, hoursPerDay, holidays, absences } = data

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297
  const pageH = 210
  const marginL = 10
  const marginR = 10
  const usableW = pageW - marginL - marginR

  // ── Header ──
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pageW, 22, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Timesheet', marginL, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${MONTHS[month - 1]} ${year}`, marginL, 18)

  doc.setFontSize(8)
  doc.text(orgName, pageW - marginR, 11, { align: 'right' })
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageW - marginR, 18, { align: 'right' })

  // ── Person info ──
  let y = 30
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(person.full_name, marginL, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const infoItems = [
    person.department && `Department: ${person.department}`,
    person.role && `Role: ${person.role}`,
    `FTE: ${person.fte}`,
    person.employment_type && `Type: ${person.employment_type}`,
  ].filter(Boolean)
  doc.text(infoItems.join('  ·  '), marginL, y + 5)

  // Status
  if (envelope) {
    const statusText = `Status: ${envelope.status}`
    doc.setTextColor(...PRIMARY)
    doc.setFont('helvetica', 'bold')
    doc.text(statusText, pageW - marginR, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    const dates = [
      envelope.submitted_at && `Submitted: ${new Date(envelope.submitted_at).toLocaleDateString('en-GB')}`,
      envelope.approved_at && `Approved: ${new Date(envelope.approved_at).toLocaleDateString('en-GB')}`,
    ].filter(Boolean)
    if (dates.length) doc.text(dates.join('  ·  '), pageW - marginR, y + 5, { align: 'right' })
  }

  y += 12

  // ── Build calendar ──
  const daysInMonth = new Date(year, month, 0).getDate()
  const calDays: { dateStr: string; dayNum: number; dow: number; isWeekend: boolean; isHoliday: boolean; isAbsence: boolean }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    const dateStr = toDateStr(date)
    calDays.push({
      dateStr,
      dayNum: d,
      dow,
      isWeekend: dow === 0 || dow === 6,
      isHoliday: holidays.has(dateStr),
      isAbsence: absences.has(dateStr),
    })
  }

  // ── Build project rows ──
  const projectDayMap = new Map<string, Map<string, TimesheetDay>>()
  for (const d of days) {
    const key = `${d.project_id}:${d.work_package_id ?? ''}`
    if (!projectDayMap.has(key)) projectDayMap.set(key, new Map())
    projectDayMap.get(key)!.set(d.date, d)
  }

  // Collect unique project+WP combos
  const projectKeys = Array.from(projectDayMap.keys())
  const projectMap = new Map(projects.map(p => [p.id, p]))

  // ── Grid dimensions ──
  const labelColW = 38
  const totalColW = 14
  const dayColW = Math.min(7, (usableW - labelColW - totalColW) / daysInMonth)
  const gridW = labelColW + dayColW * daysInMonth + totalColW
  const rowH = 6
  const headerH = 10
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  // ── Draw grid header ──
  doc.setFillColor(...LIGHT_BG)
  doc.rect(marginL, y, gridW, headerH, 'F')
  doc.setDrawColor(...BORDER)
  doc.line(marginL, y + headerH, marginL + gridW, y + headerH)

  // Project label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text('Project / WP', marginL + 1, y + 4)

  // Day headers
  for (let i = 0; i < daysInMonth; i++) {
    const d = calDays[i]
    const x = marginL + labelColW + i * dayColW
    const cx = x + dayColW / 2

    if (d.isWeekend) {
      doc.setFillColor(240, 240, 243)
      doc.rect(x, y, dayColW, headerH, 'F')
    }
    if (d.isHoliday) {
      doc.setFillColor(254, 242, 242)
      doc.rect(x, y, dayColW, headerH, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.5)
    doc.setTextColor(...MUTED)
    doc.text(dayNames[d.dow], cx, y + 3.5, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    if (d.isHoliday) doc.setTextColor(220, 50, 50)
    else doc.setTextColor(...DARK)
    doc.text(String(d.dayNum), cx, y + 8, { align: 'center' })
  }

  // Total header
  const totalX = marginL + labelColW + daysInMonth * dayColW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...DARK)
  doc.text('Total', totalX + totalColW / 2, y + 6, { align: 'center' })

  y += headerH

  const workingDays = getWorkingDaysInMonth(year, month)

  // ── Draw project rows ──
  for (let ri = 0; ri < projectKeys.length; ri++) {
    const pKey = projectKeys[ri]
    const [projId, wpId] = pKey.split(':')
    const proj = projectMap.get(projId)
    const dayMap = projectDayMap.get(pKey)!
    const isNational = proj?.funding_schemes?.requires_time_range ?? false

    // Check page overflow
    if (y + rowH > pageH - 30) {
      doc.addPage()
      y = 15
    }

    // Stripe
    if (ri % 2 === 1) {
      doc.setFillColor(252, 252, 253)
      doc.rect(marginL, y, gridW, rowH, 'F')
    }

    // Project label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    if (isNational) doc.setTextColor(...AMBER)
    else doc.setTextColor(...DARK)
    const label = (proj?.acronym ?? '—') + (wpId ? ` / ${wpId}` : '')
    doc.text(label.length > 22 ? label.slice(0, 19) + '...' : label, marginL + 1, y + 4)

    // Day cells
    let rowTotal = 0
    for (let i = 0; i < daysInMonth; i++) {
      const d = calDays[i]
      const x = marginL + labelColW + i * dayColW
      const cx = x + dayColW / 2
      const entry = dayMap.get(d.dateStr)
      const hours = entry?.hours ?? 0

      if (d.isWeekend) {
        doc.setFillColor(240, 240, 243)
        doc.rect(x, y, dayColW, rowH, 'F')
      } else if (d.isHoliday) {
        doc.setFillColor(254, 242, 242)
        doc.rect(x, y, dayColW, rowH, 'F')
      } else if (d.isAbsence) {
        doc.setFillColor(239, 246, 255)
        doc.rect(x, y, dayColW, rowH, 'F')
      }

      if (hours > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5)
        doc.setTextColor(...DARK)
        doc.text(hours % 1 === 0 ? String(hours) : hours.toFixed(1), cx, y + 4, { align: 'center' })
        rowTotal += hours
      }
    }

    // Row total
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(...DARK)
    doc.text(rowTotal > 0 ? rowTotal.toFixed(1) : '—', totalX + totalColW / 2, y + 4, { align: 'center' })

    // Row bottom border
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.1)
    doc.line(marginL, y + rowH, marginL + gridW, y + rowH)

    y += rowH
  }

  // ── Daily totals row ──
  if (y + rowH > pageH - 30) { doc.addPage(); y = 15 }
  doc.setFillColor(...LIGHT_BG)
  doc.rect(marginL, y, gridW, rowH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  doc.setTextColor(...MUTED)
  doc.text('DAILY TOTAL', marginL + 1, y + 4)

  let grandTotal = 0
  for (let i = 0; i < daysInMonth; i++) {
    const d = calDays[i]
    const x = marginL + labelColW + i * dayColW
    const cx = x + dayColW / 2
    let dayTotal = 0
    for (const dayMap of projectDayMap.values()) {
      const entry = dayMap.get(d.dateStr)
      if (entry) dayTotal += entry.hours
    }
    grandTotal += dayTotal
    if (dayTotal > 0 && !d.isWeekend) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5)
      if (dayTotal > hoursPerDay) doc.setTextColor(220, 50, 50)
      else doc.setTextColor(...DARK)
      doc.text(dayTotal % 1 === 0 ? String(dayTotal) : dayTotal.toFixed(1), cx, y + 4, { align: 'center' })
    }
  }

  // Grand total
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...PRIMARY)
  doc.text(grandTotal.toFixed(1), totalX + totalColW / 2, y + 4, { align: 'center' })
  y += rowH + 3

  // ── Summary ──
  if (y + 25 > pageH - 30) { doc.addPage(); y = 15 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text('Summary', marginL, y)
  y += 6

  const pm = hoursToPm(grandTotal, workingDays, hoursPerDay)
  const capacity = workingDays * hoursPerDay

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`Total Hours: `, marginL, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(`${grandTotal.toFixed(1)}h`, marginL + 25, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`Person-Months: `, marginL + 55, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(formatPm(pm), marginL + 80, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`Capacity: `, marginL + 110, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(`${capacity}h (${workingDays} days × ${hoursPerDay}h)`, marginL + 130, y)

  y += 10

  // ── Arbeitszeitnachweis (time-range tracking details) ──
  const nationalEntries = days.filter(d => {
    const proj = projectMap.get(d.project_id)
    return proj?.funding_schemes?.requires_time_range && (d.start_time || d.end_time || d.description)
  })
  if (nationalEntries.length > 0) {
    if (y + 15 > pageH - 30) { doc.addPage(); y = 15 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...AMBER)
    doc.text('Arbeitszeitnachweis — Tätigkeitsbeschreibung', marginL, y)
    y += 6

    // Table header
    doc.setFillColor(...LIGHT_BG)
    doc.rect(marginL, y - 3, usableW, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...MUTED)
    doc.text('Date', marginL + 1, y)
    doc.text('Project', marginL + 25, y)
    doc.text('Start', marginL + 60, y)
    doc.text('End', marginL + 78, y)
    doc.text('Hours', marginL + 96, y)
    doc.text('Activity Description', marginL + 112, y)
    y += 5

    for (let i = 0; i < nationalEntries.length; i++) {
      if (y + 5 > pageH - 20) { doc.addPage(); y = 15 }
      const entry = nationalEntries[i]
      const proj = projectMap.get(entry.project_id)
      const d = new Date(entry.date + 'T00:00:00')
      const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })

      if (i % 2 === 1) {
        doc.setFillColor(252, 252, 253)
        doc.rect(marginL, y - 3, usableW, 5, 'F')
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(...DARK)
      doc.text(dateStr, marginL + 1, y)
      doc.text(proj?.acronym ?? '—', marginL + 25, y)
      doc.text(entry.start_time ?? '—', marginL + 60, y)
      doc.text(entry.end_time ?? '—', marginL + 78, y)
      doc.text(entry.hours > 0 ? entry.hours.toFixed(1) + 'h' : '—', marginL + 96, y)
      const desc = entry.description ?? ''
      doc.text(desc.length > 80 ? desc.slice(0, 77) + '...' : desc, marginL + 112, y)
      y += 5
    }
    y += 5
  }

  // ── Signature area ──
  const sigBlockH = 65
  if (y + sigBlockH > pageH - 12) { doc.addPage(); y = 15 }
  y = Math.max(y, pageH - sigBlockH - 8)

  // Declaration
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(...DARK)
  doc.text(
    'I hereby confirm that the hours recorded above are a true and accurate account of the work performed during the stated period.',
    marginL, y, { maxWidth: usableW }
  )
  y += 10

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)

  const sigColW = (usableW - 10) / 2

  // Employee signature
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('Employee', marginL, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...DARK)
  y += 5
  doc.text(`Name: ${person.full_name}`, marginL, y)
  y += 5
  doc.text(`Position: ${(person as any).position ?? '___________________________'}`, marginL, y)
  y += 8
  doc.text('Signature:', marginL, y)
  doc.line(marginL + 18, y, marginL + sigColW, y)
  y += 7
  doc.text('Date:', marginL, y)
  doc.line(marginL + 12, y, marginL + 60, y)

  // Approver signature (right column, same vertical position)
  const appY = y - 25
  const appX = marginL + sigColW + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('Supervisor / Approver', appX, appY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...DARK)
  doc.text('Name: ___________________________', appX, appY + 5)
  doc.text('Position: ___________________________', appX, appY + 10)
  doc.text('Signature:', appX, appY + 18)
  doc.line(appX + 18, appY + 18, appX + sigColW, appY + 18)
  doc.text('Date:', appX, appY + 25)
  doc.line(appX + 12, appY + 25, appX + 60, appY + 25)

  // ── Footer ──
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(6)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${p} of ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' })
    doc.text('GrantLume — Timesheet Report', marginL, pageH - 5)
  }

  // Save
  const fileName = `Timesheet_${person.full_name.replace(/\s+/g, '_')}_${year}_${String(month).padStart(2, '0')}.pdf`
  doc.save(fileName)
}
