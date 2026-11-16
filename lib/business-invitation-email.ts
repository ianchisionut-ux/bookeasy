import { escapeEmail } from './invitation-mail'

export const DEFAULT_INVITATION_HEADER = '/email/bookeasy-invitation-header-wide.jpg'
export function validInvitationHeader(value: string | undefined | null) {
  if (!value) return null
  if (value === DEFAULT_INVITATION_HEADER) return value
  return /^\/api\/storage\/public\/public\/invitation-headers\/[a-f0-9-]{36}\.jpg$/.test(value) ? value : null
}

export function businessInvitationEmail(input: { businessName: string; offerDescription: string; ctaUrl: string; existing: boolean; headerImageUrl?: string | null }) {
  const safe = escapeEmail
  const name = input.businessName || 'afacerea ta'
  const lead = input.existing
    ? `Ai primit acces pentru ${name}. Continuă configurarea folosind invitația de mai jos.`
    : `Super Admin BookEasy ți-a oferit acces pentru ${name}. Alege o parolă și configurează contul.`
  const text = `BookEasy — invitație pentru ${name}\n\nSalut,\n\n${lead}\n\nPlan atribuit: ${input.offerDescription}\n\nLinkul este valabil 24 de ore: ${input.ctaUrl}\n\nDacă nu recunoști invitația, ignoră acest email.\nBookEasy · contact@bookeasy.ro · +40 712 345 002`
  const html = `<!doctype html><html lang="ro"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f7f6;font-family:Arial,Helvetica,sans-serif;color:#243c40"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f7f6"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="padding:32px"><img src="https://bookeasy.ro/logo.png" width="145" alt="BookEasy" style="display:block;max-width:100%;height:auto;border:0;margin-bottom:30px"><h1 style="font-size:25px;color:#173d41;margin:0 0 18px">Invitație BookEasy</h1><p style="font-size:15px;line-height:1.65">Salut,</p><p style="font-size:15px;line-height:1.65">${safe(lead)}</p><p style="font-size:14px;line-height:1.6">${safe(input.offerDescription)}</p><p style="font-size:13px;line-height:1.6;color:#536b6f">Linkul este valabil 24 de ore. Dacă nu recunoști invitația, ignoră acest email.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td bgcolor="#168e92" style="border-radius:10px"><a href="${safe(input.ctaUrl)}" style="display:inline-block;padding:15px 24px;font-size:15px;font-weight:bold;color:#fff;text-decoration:none">Acceptă invitația</a></td></tr></table><p style="font-size:12px;word-break:break-all;color:#738689">${safe(input.ctaUrl)}</p></td></tr><tr><td style="padding:18px 32px;border-top:1px solid #e5efee;font-size:12px;color:#738689">BookEasy · <a href="mailto:contact@bookeasy.ro">contact@bookeasy.ro</a> · <a href="tel:+40712345002">+40 712 345 002</a></td></tr></table></td></tr></table></body></html>`
  return { text, html }
}
