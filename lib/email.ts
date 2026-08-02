import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
  await resend.emails.send({
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
