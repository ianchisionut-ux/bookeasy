import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { putR2File, r2Url } from '@/lib/r2-storage'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

async function ownsPatient(customerId: string, businessId: string) {
  const c = await prisma.customer.findUnique({ where: { id: customerId } })
  return c && c.businessId === businessId ? c : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await ownsPatient(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { allowed } = rateLimit(`patient-doc-upload:${businessId}`, 40, 60 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Prea multe încărcări recente. Așteaptă puțin.' }, { status: 429 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Niciun fișier trimis.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fișierul e prea mare (max 15MB).' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Sunt acceptate doar fișiere PDF, JPG, PNG, DOC și DOCX.' }, { status: 400 })
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'document'
  const filename = `patients/${businessId}/${id}/${Date.now()}-${safeName}`

  try {
    await putR2File(filename, file)

    const doc = await prisma.patientDocument.create({
      data: { customerId: id, businessId, url: r2Url(filename), filename: file.name },
    })

    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        uploadedAt: doc.uploadedAt,
        url: `/api/business/patients/${id}/documents/${doc.id}`,
      },
    })
  } catch (err: any) {
    console.error('Eroare la upload document pacient:', err)
    return NextResponse.json({ error: `Upload eșuat: ${err?.message ?? 'eroare necunoscută'}` }, { status: 500 })
  }
}
