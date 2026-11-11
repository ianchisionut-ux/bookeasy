import crypto from 'crypto'
import { Resend } from 'resend'
import { prisma } from './prisma'
import { putR2File } from './r2-storage'

export const CONTACT_EMAIL = 'contact@bookeasy.ro'
const RESEND_API = 'https://api.resend.com'

type ReceivedEmail = {
  id: string
  message_id?: string
  from?: string
  to?: string[]
  reply_to?: string[] | string
  subject?: string
  text?: string
  html?: string
  created_at?: string
  attachments?: { id: string; filename?: string; content_type?: string; content_id?: string; size?: number }[]
}

function apiKey() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY lipsește.')
  return process.env.RESEND_API_KEY
}

async function resendGet<T>(path: string): Promise<T> {
  const response = await fetch(`${RESEND_API}${path}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Resend API a răspuns cu ${response.status}.`)
  return response.json() as Promise<T>
}

async function getReceivedEmail(emailId: string) {
  return resendGet<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}?html_format=cid`)
}

export function verifyResendWebhook(payload: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatures = headers.get('svix-signature')
  if (!secret?.startsWith('whsec_') || !id || !timestamp || !signatures) return false
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false
  let key: Buffer
  try { key = Buffer.from(secret.slice(6), 'base64') } catch { return false }
  if (!key.length) return false
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest()
  return signatures.split(' ').some((part) => {
    const [version, value] = part.split(',', 2)
    if (version !== 'v1' || !value) return false
    try {
      const actual = Buffer.from(value, 'base64')
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
    } catch { return false }
  })
}

function plainText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .trim()
}

function emailAddress(value: string) {
  return (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase()
}

export function validEmail(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
}

export async function importReceivedEmail(emailId: string) {
  const data = await getReceivedEmail(emailId)
  const recipients = Array.isArray(data.to) ? data.to : []
  if (!recipients.some((value) => emailAddress(value) === CONTACT_EMAIL)) return null
  const replyTo = Array.isArray(data.reply_to) ? data.reply_to[0] : data.reply_to
  const receivedAt = data.created_at ? new Date(data.created_at) : new Date()
  const email = await prisma.platformEmail.upsert({
    where: { providerEmailId: emailId },
    create: {
      providerEmailId: emailId, providerMessageId: data.message_id || null,
      direction: 'inbound', folder: 'inbox', fromAddress: data.from || '',
      toAddresses: recipients, replyTo: replyTo || null, subject: data.subject || '(fără subiect)',
      bodyText: (data.text || plainText(data.html || '')).slice(0, 1_000_000),
      bodyHtml: data.html?.slice(0, 5_000_000) || null,
      threadKey: data.message_id || emailId, receivedAt,
    },
    update: { ...(data.html ? { bodyHtml: data.html.slice(0, 5_000_000) } : {}) },
  })

  for (const attachment of data.attachments || []) {
    if (!attachment.id) continue
    const existing = await prisma.platformEmailAttachment.findUnique({
      where: { emailId_providerAttachmentId: { emailId: email.id, providerAttachmentId: attachment.id } },
    })
    if (existing?.storageKey) {
      if (attachment.content_id && existing.contentId !== attachment.content_id) {
        await prisma.platformEmailAttachment.update({ where: { id: existing.id }, data: { contentId: attachment.content_id } })
      }
      continue
    }
    const detail = await resendGet<{ download_url?: string; filename?: string; content_type?: string; size?: number }>(
      `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachment.id)}`
    )
    if (!detail.download_url?.startsWith('https://')) throw new Error('URL de atașament invalid.')
    const download = await fetch(detail.download_url, { cache: 'no-store' })
    if (!download.ok) throw new Error(`Atașamentul nu a putut fi descărcat: ${download.status}`)
    const bytes = await download.arrayBuffer()
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Atașamentul depășește 25 MB.')
    const filename = (attachment.filename || detail.filename || 'atasament').replace(/[\\/\r\n]/g, '_').slice(0, 150)
    const contentType = attachment.content_type || detail.content_type || 'application/octet-stream'
    const key = `platform-email/${email.id}/${attachment.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    await putR2File(key, new File([bytes], filename, { type: contentType }), { allowOverwrite: true })
    await prisma.platformEmailAttachment.upsert({
      where: { emailId_providerAttachmentId: { emailId: email.id, providerAttachmentId: attachment.id } },
      create: { emailId: email.id, providerAttachmentId: attachment.id, filename, contentType, contentId: attachment.content_id || null, size: bytes.byteLength, storageKey: key },
      update: { filename, contentType, contentId: attachment.content_id || null, size: bytes.byteLength, storageKey: key },
    })
  }
  return email
}

export async function restoreReceivedEmailHtml(emailId: string, providerEmailId: string) {
  const data = await getReceivedEmail(providerEmailId)
  if (!data.html) return null
  const bodyHtml = data.html.slice(0, 5_000_000)
  await prisma.platformEmail.update({ where: { id: emailId }, data: { bodyHtml } })
  for (const attachment of data.attachments || []) {
    if (!attachment.id || !attachment.content_id) continue
    await prisma.platformEmailAttachment.updateMany({
      where: { emailId, providerAttachmentId: attachment.id },
      data: { contentId: attachment.content_id },
    })
  }
  return bodyHtml
}

export async function sendPlatformEmail({ to, subject, message, replyToMessageId }: {
  to: string; subject: string; message: string; replyToMessageId?: string | null
}) {
  const recipient = emailAddress(to)
  if (!validEmail(recipient) || !subject.trim() || !message.trim()) throw new Error('Destinatarul, subiectul și mesajul sunt obligatorii.')
  const headers = replyToMessageId ? { 'In-Reply-To': replyToMessageId, References: replyToMessageId } : undefined
  const resend = new Resend(apiKey())
  const result = await resend.emails.send({
    from: `Bookeasy <${CONTACT_EMAIL}>`, to: recipient, subject: subject.trim(),
    text: message.trim(), replyTo: CONTACT_EMAIL, ...(headers ? { headers } : {}),
  })
  if (result.error || !result.data?.id) throw new Error(result.error?.message || 'Resend nu a acceptat e-mailul.')
  return prisma.platformEmail.create({ data: {
    providerEmailId: result.data.id, direction: 'outbound', folder: 'sent',
    fromAddress: CONTACT_EMAIL, toAddresses: [recipient], replyTo: CONTACT_EMAIL,
    subject: subject.trim(), bodyText: message.trim(), isRead: true,
    threadKey: replyToMessageId || result.data.id, sentAt: new Date(),
  } })
}
