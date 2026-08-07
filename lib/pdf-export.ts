import jsPDF from 'jspdf'

// export bazat pe elementul HTML randat real în browser — păstrează corect diacriticele
// (ă, â, î, ș, ț), spre deosebire de fonturile built-in ale jsPDF, care le pierd complet
export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  await new Promise<void>((resolve) => {
    doc.html(element, {
      callback: () => resolve(),
      margin: [10, 10, 10, 10],
      autoPaging: 'text',
      width: 190, // lățime utilă A4 (mm), redusă pentru margini
      windowWidth: element.scrollWidth || 800,
      html2canvas: { scale: 0.26 }, // corelat cu raportul px→mm, ca textul să nu iasă tăiat
    })
  })
  doc.save(filename)
}

export type PdfSection = {
  title: string
  rows: { label: string; value: string }[]
}

export function exportSectionsToPdf(
  filename: string,
  heading: string,
  subheading: string,
  sections: PdfSection[],
  options: { keepEmptyRows?: boolean } = {}
) {
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
    const rows = options.keepEmptyRows ? section.rows : section.rows.filter((r) => r.value && r.value.trim() !== '')
    if (rows.length === 0) continue

    ensureSpace(12)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(section.title, marginX, y)
    y += 6
    doc.setDrawColor(220)
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const row of rows) {
      const value = row.value && row.value.trim() !== '' ? row.value : '.......................................'
      const text = `${row.label}: ${value}`
      const lines = doc.splitTextToSize(text, maxWidth)
      ensureSpace(lines.length * 5 + 2)
      doc.text(lines, marginX, y)
      y += lines.length * 5 + 2
    }
    y += 3
  }

  doc.save(filename)
}
