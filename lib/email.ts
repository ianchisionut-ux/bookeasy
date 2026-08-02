import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResend() {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY nu e setat — email-urile de alertă nu pot fi trimise.')
    }
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook Messenger',
  GOOGLE_BUSINESS: 'Google Business Profile',
}

export async function sendAlertEmail({
  to,
  subject,
  businessName,
  channelType,
  isExpired,
  daysLeft,
  reconnectUrl,
}: {
  to: string
  subject: string
  businessName: string
  channelType: string
  isExpired: boolean
  daysLeft: number
  reconnectUrl: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY lipsește — sar peste trimiterea email-ului de alertă.')
    return
  }

  await getResend().emails.send({
    from: 'Notificări <alerte@bookeasy.ro>',
    to,
    subject,
    html: `
      <p>Salut,</p>
      <p>${
        isExpired
          ? `Conexiunea ${businessName} cu <strong>${CHANNEL_LABELS[channelType] ?? channelType}</strong> a expirat sau nu e conectată. Botul nu mai poate primi sau răspunde la mesaje pe acest canal.`
          : `Conexiunea ${businessName} cu <strong>${CHANNEL_LABELS[channelType] ?? channelType}</strong> expiră în ${daysLeft} zile.`
      }</p>
      <p><a href="${reconnectUrl}">Reconectează canalul</a> ca să nu pierzi rezervări.</p>
    `,
  })
}
