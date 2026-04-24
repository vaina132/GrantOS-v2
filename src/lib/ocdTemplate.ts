import { jsPDF } from 'jspdf'

/**
 * Blank Ownership Control Declaration (OCD) template.
 *
 * The European Commission requires an OCD from every beneficiary on a
 * Horizon Europe / Digital Europe / CEF grant. The official OCD form is
 * reached through the Funding & Tenders Portal once a proposal is under
 * evaluation — it isn't published as a stable public PDF — so we ship our
 * own blank template modelled on the EC structure. The coordinator can
 * override `template_url` per-document if they have a newer EC version.
 *
 * Fields included (in order on the PDF):
 *   1. Legal entity identification — legal name, registered address,
 *      country, PIC number (if already issued), legal form, VAT.
 *   2. Ultimate controller — name, nationality, country of residence,
 *      percent of voting rights / ownership, whether the controller is a
 *      natural person / public body / company / other.
 *   3. Ownership chain — free-form table for intermediate entities.
 *   4. Sanctioned / restricted-country declaration — yes/no checkboxes
 *      for the EU restrictive measures list (per EU Reg. 2580/2001 and
 *      Council Decisions under CFSP).
 *   5. Signatory — legal representative name, position, place, date,
 *      signature line.
 *
 * The generated PDF is a fillable-by-hand form, not a Web form. Partners
 * download, print, sign, and upload the scanned version via the normal
 * submission flow.
 */

const M = 18 // page margin in mm
const LINE_H = 6 // line height in mm
const FORM_VERSION = 'v1.0 — aligned with EC AGA §Annex 1 guidance on ownership and control'

/**
 * Generate the OCD template PDF and trigger a browser download.
 * @param opts.partnerName    Optional pre-fill for section 1 (legal name).
 * @param opts.fileName       Download file name. Defaults to "OCD-template.pdf".
 */
export function generateOcdTemplatePdf(opts?: {
  partnerName?: string
  fileName?: string
}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - M * 2

  // ── Title ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Ownership Control Declaration', M, M + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text(
    'European Union grants — declaration by the beneficiary on ownership and control.',
    M,
    M + 11,
  )
  doc.text(FORM_VERSION, M, M + 16)
  doc.setTextColor(0)

  // A thin rule under the header.
  doc.setLineWidth(0.3)
  doc.line(M, M + 20, pageW - M, M + 20)

  let y = M + 27

  // ── Section 1 — Legal entity ────────────────────────────────
  y = section(doc, '1. Legal entity', y)
  y = field(doc, 'Legal name', M, y, contentW, opts?.partnerName ?? '')
  y = field(doc, 'Registered address', M, y, contentW)
  y = twoCol(doc, 'Country', '', 'PIC number (if any)', '', M, y, contentW)
  y = twoCol(doc, 'Legal form', '', 'VAT / tax id', '', M, y, contentW)

  // ── Section 2 — Ultimate controller ─────────────────────────
  y = section(doc, '2. Ultimate controller', y + 4)
  y = paragraph(
    doc,
    'The ultimate controller is the natural person or public body that ultimately owns or controls the legal entity, directly or indirectly, through voting rights, ownership interest, or contractual arrangement. If multiple controllers exist, attach a separate sheet.',
    y,
    contentW,
  )
  y = field(doc, 'Full name', M, y, contentW)
  y = twoCol(doc, 'Nationality', '', 'Country of residence', '', M, y, contentW)
  y = twoCol(doc, '% voting rights', '', '% ownership / capital', '', M, y, contentW)
  y = checkboxRow(
    doc,
    'Type of controller',
    ['Natural person', 'Public body', 'Company', 'Other'],
    M,
    y,
    contentW,
  )

  // ── Section 3 — Ownership chain ─────────────────────────────
  y = section(doc, '3. Ownership chain (intermediate entities)', y + 4)
  y = paragraph(
    doc,
    'List any intermediate legal entities between the beneficiary and the ultimate controller. Attach a separate sheet if you need more rows.',
    y,
    contentW,
  )
  y = tableHeader(doc, ['#', 'Legal entity', 'Country', '% ownership'], [10, contentW - 60, 25, 25], M, y)
  for (let i = 1; i <= 4; i++) {
    y = tableRow(doc, [String(i), '', '', ''], [10, contentW - 60, 25, 25], M, y)
  }

  // ── Section 4 — Sanctions declaration ───────────────────────
  y = pageBreakIfNeeded(doc, y, 50)
  y = section(doc, '4. Restrictive measures declaration', y + 4)
  y = paragraph(
    doc,
    'The beneficiary declares that neither the legal entity itself, nor its ultimate controller, is subject to EU restrictive measures adopted under Article 29 of the Treaty on European Union or Article 215 of the Treaty on the Functioning of the European Union.',
    y,
    contentW,
  )
  y = yesNoQuestion(doc, 'Is the beneficiary subject to EU restrictive measures?', M, y, contentW)
  y = yesNoQuestion(doc, 'Is the ultimate controller subject to EU restrictive measures?', M, y, contentW)
  y = yesNoQuestion(
    doc,
    'Is the beneficiary controlled by an entity established in a country listed in the EU common list of non-cooperative jurisdictions?',
    M,
    y,
    contentW,
  )

  // ── Section 5 — Signature ───────────────────────────────────
  y = pageBreakIfNeeded(doc, y, 55)
  y = section(doc, '5. Signature', y + 4)
  y = paragraph(
    doc,
    'The undersigned, duly authorised to represent the beneficiary, certifies that the information given in this declaration is true, complete, and accurate.',
    y,
    contentW,
  )
  y = field(doc, 'Name of legal representative', M, y, contentW)
  y = twoCol(doc, 'Position / title', '', 'Place', '', M, y, contentW)
  y = field(doc, 'Date', M, y, contentW)

  // Signature block
  y += 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Signature', M, y)
  doc.setLineWidth(0.3)
  doc.line(M, y + 14, M + contentW * 0.6, y + 14)

  // Footer on every page.
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(
      `OCD template — page ${i} of ${pages}`,
      M,
      doc.internal.pageSize.getHeight() - 8,
    )
    doc.text(
      'Generated by GrantLume. Supersede with your call’s official OCD form if provided.',
      pageW - M,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    )
    doc.setTextColor(0)
  }

  doc.save(opts?.fileName ?? 'OCD-template.pdf')
}

// ─────────────────────────────────────────────────────────────────
// Layout helpers. Kept local so the template's layout logic stays in
// one place — this file is the single source of truth for the OCD PDF.
// ─────────────────────────────────────────────────────────────────

function section(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(title, M, y)
  return y + LINE_H
}

function paragraph(doc: jsPDF, text: string, y: number, w: number): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(70)
  const lines = doc.splitTextToSize(text, w)
  doc.text(lines, M, y)
  doc.setTextColor(0)
  return y + lines.length * 4.2 + 2
}

function field(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  w: number,
  prefill?: string,
): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(label, x, y)
  doc.setTextColor(0)
  // The line to write on.
  doc.setLineWidth(0.2)
  doc.line(x, y + 6, x + w, y + 6)
  if (prefill) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(prefill, x + 1, y + 5)
  }
  return y + 11
}

function twoCol(
  doc: jsPDF,
  label1: string,
  val1: string,
  label2: string,
  val2: string,
  x: number,
  y: number,
  w: number,
): number {
  const half = (w - 6) / 2
  field(doc, label1, x, y, half, val1)
  field(doc, label2, x + half + 6, y, half, val2)
  return y + 11
}

function checkboxRow(
  doc: jsPDF,
  label: string,
  options: string[],
  x: number,
  y: number,
  w: number,
): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80)
  doc.text(label, x, y)
  doc.setTextColor(0)
  const gap = w / options.length
  for (let i = 0; i < options.length; i++) {
    const cx = x + i * gap
    doc.setLineWidth(0.3)
    doc.rect(cx, y + 3, 3.5, 3.5)
    doc.setFontSize(9)
    doc.text(options[i], cx + 5, y + 6)
  }
  return y + 12
}

function yesNoQuestion(
  doc: jsPDF,
  question: string,
  x: number,
  y: number,
  w: number,
): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const lines = doc.splitTextToSize(question, w - 40)
  doc.text(lines, x, y + 4)
  const boxY = y + 1
  const boxX = x + w - 34
  doc.setLineWidth(0.3)
  doc.rect(boxX, boxY, 3.5, 3.5)
  doc.text('Yes', boxX + 5, boxY + 3)
  doc.rect(boxX + 15, boxY, 3.5, 3.5)
  doc.text('No', boxX + 20, boxY + 3)
  return y + lines.length * 4.2 + 6
}

function tableHeader(
  doc: jsPDF,
  labels: string[],
  widths: number[],
  x: number,
  y: number,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setFillColor(240, 240, 240)
  const totalW = widths.reduce((a, b) => a + b, 0)
  doc.rect(x, y, totalW, 6, 'F')
  let cursor = x
  for (let i = 0; i < labels.length; i++) {
    doc.text(labels[i], cursor + 1.5, y + 4)
    cursor += widths[i]
  }
  doc.setFont('helvetica', 'normal')
  return y + 6
}

function tableRow(
  doc: jsPDF,
  cells: string[],
  widths: number[],
  x: number,
  y: number,
): number {
  const totalW = widths.reduce((a, b) => a + b, 0)
  doc.setLineWidth(0.2)
  doc.rect(x, y, totalW, 8)
  let cursor = x
  for (let i = 0; i < widths.length; i++) {
    if (i > 0) {
      doc.line(cursor, y, cursor, y + 8)
    }
    if (cells[i]) {
      doc.setFontSize(9)
      doc.text(cells[i], cursor + 1.5, y + 5)
    }
    cursor += widths[i]
  }
  return y + 8
}

function pageBreakIfNeeded(doc: jsPDF, y: number, minRemaining: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + minRemaining > pageH - M) {
    doc.addPage()
    return M + 10
  }
  return y
}
