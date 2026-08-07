import jsPDF from 'jspdf'

export type PdfSection = {
  title: string
  rows: { label: string; value: string }[]
}

export function exportSectionsToPdf(filename: string, heading: string, subheading: string, sections: PdfSection[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 15
  const maxWidth = pageWidth - marginX * 2
  let y = 18

  function ensureSpace(needed: number) {
    if (y + needed > 280) {
      doc.addPage()
      y = 18
    }
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(heading, marginX, y)
  y += 7

  if (subheading) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(subheading, marginX, y)
    doc.setTextColor(0)
    y += 8
  } else {
    y += 3
  }

  for (const section of sections) {
    const nonEmptyRows = section.rows.filter((r) => r.value && r.value.trim() !== '')
    if (nonEmptyRows.length === 0) continue

    ensureSpace(12)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(section.title, marginX, y)
    y += 6
    doc.setDrawColor(220)
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const row of nonEmptyRows) {
      const text = `${row.label}: ${row.value}`
      const lines = doc.splitTextToSize(text, maxWidth)
      ensureSpace(lines.length * 5 + 2)
      doc.text(lines, marginX, y)
      y += lines.length * 5 + 2
    }
    y += 3
  }

  doc.save(filename)
}
