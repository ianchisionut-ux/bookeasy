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

export async function sendAccessRequestNotification({
  name,
  businessName,
  email,
  phone,
  category,
  message,
}: {
  name: string
  businessName: string
  email: string
  phone: string
  category: string | null
  message: string | null
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY lipsește — sar peste notificarea de cerere de acces.')
    return
  }

  const to = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!to) {
    console.warn('ADMIN_NOTIFICATION_EMAIL lipsește — sar peste notificarea de cerere de acces.')
    return
  }

  await getResend().emails.send({
    from: 'bookeasy.ro <cont@bookeasy.ro>',
    to,
    subject: `Cerere de acces nouă — ${businessName}`,
    html: `
      <p>Cerere nouă de pe homepage:</p>
      <ul>
        <li><strong>Nume:</strong> ${name}</li>
        <li><strong>Afacere:</strong> ${businessName}</li>
        <li><strong>Categorie:</strong> ${category ?? '—'}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Telefon:</strong> ${phone}</li>
        ${message ? `<li><strong>Mesaj:</strong> ${message}</li>` : ''}
      </ul>
      <p><a href="${process.env.APP_URL}/superadmin/cereri">Vezi toate cererile</a></p>
    `,
  })
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
