import {escapeEmail} from './invitation-mail'

export const DEFAULT_INVITATION_HEADER='/email/bookeasy-invitation-header-wide.jpg'
export function validInvitationHeader(value:string|undefined|null){
 if(!value)return null
 if(value===DEFAULT_INVITATION_HEADER)return value
 return /^\/api\/storage\/public\/public\/invitation-headers\/[a-f0-9-]{36}\.jpg$/.test(value)?value:null
}

const features=[
 ['Mai ușor de găsit','Profilul public prezintă serviciile, fotografiile și informațiile afacerii. După aprobare, oamenii te pot descoperi prin categorii și pe hartă.'],
 ['Rezervări într-un singur loc','Primești solicitările online într-un calendar, îți stabilești programul, pauzele și disponibilitatea și urmărești statusul fiecărei programări.'],
 ['Clienți și conversații','Păstrezi istoricul programărilor și datele clienților. Cu integrările configurate, poți gestiona conversații Messenger și Instagram din panoul afacerii.'],
 ['Decizii din date','Urmărești programările, gradul de ocupare și evoluția activității în statistici; funcțiile disponibile depind de planul activ.'],
] as const

export function businessInvitationEmail(input:{businessName:string;offerDescription:string;ctaUrl:string;existing:boolean;headerImageUrl?:string|null}){
 const image=validInvitationHeader(input.headerImageUrl)||DEFAULT_INVITATION_HEADER
 const imageUrl=`https://bookeasy.ro${image}`
 const name=input.businessName||'afacerea ta'
 const lead=input.existing?`Continuă configurarea pentru ${name} folosind invitația de mai jos.`:`Te invităm să înscrii ${name} pe BookEasy și să îți organizezi activitatea mai simplu.`
 const terms=input.existing?'Conectează-te cu contul tău existent. Invitația nu îți schimbă automat planul.':'La înscriere îți confirmi adresa, alegi parola și accepți condițiile planului înainte de configurare.'
 const cta=input.existing?'Continuă înrolarea':'Vreau să îmi înscriu afacerea'
 const text=`BookEasy — invitație pentru ${name}\n\nSalut,\n\n${lead}\n\nCe poți face cu BookEasy:\n${features.map(([title,detail])=>`• ${title}: ${detail}`).join('\n')}\n\nOferta din invitația ta: ${input.offerDescription}\n\n${terms} Funcțiile și integrările sunt disponibile conform planului ales și configurării. Linkul este valabil 24 de ore.\n\n${cta}: ${input.ctaUrl}\n\nDacă nu dorești să continui, poți ignora acest email.\nBookEasy · contact@bookeasy.ro · +40 712 345 002`
 const safe=escapeEmail
 const cards=features.map(([title,detail])=>`<tr><td style="padding:14px 0;border-bottom:1px solid #e5efee"><strong style="display:block;font-size:16px;color:#173d41;margin-bottom:5px">${safe(title)}</strong><span style="font-size:14px;line-height:1.55;color:#536b6f">${safe(detail)}</span></td></tr>`).join('')
 const html=`<!doctype html><html lang="ro"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f1f7f6;font-family:Arial,Helvetica,sans-serif;color:#243c40"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f7f6"><tr><td align="center" style="padding:12px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:1400px;background:#fff;border-radius:16px;overflow:hidden"><tr><td><img src="${safe(imageUrl)}" width="1400" alt="BookEasy – calendar, mesaje și statistici pentru afacerea ta" style="display:block;width:100%;height:auto;border:0"></td></tr><tr><td style="padding:40px 48px 16px"><p style="font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#188e91;margin:0 0 12px">INVITAȚIE PENTRU AFACEREA TA</p><h1 style="font-size:29px;line-height:1.15;color:#173d41;margin:0 0 16px">Crește cu BookEasy</h1><p style="font-size:16px;line-height:1.65;margin:0 0 14px">Salut,</p><p style="font-size:16px;line-height:1.65;margin:0 0 20px">${safe(lead)}</p><p style="font-size:16px;font-weight:bold;color:#173d41;margin:0 0 4px">Ce poți face cu BookEasy</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table><div style="background:#eaf7f4;border-radius:12px;padding:18px;margin:24px 0"><strong style="display:block;font-size:15px;color:#126f73;margin-bottom:6px">Oferta din invitația ta</strong><span style="font-size:14px;line-height:1.55;color:#27474a">${safe(input.offerDescription)}</span></div><p style="font-size:14px;line-height:1.6;color:#536b6f;margin:0 0 12px">${safe(terms)} Funcțiile și integrările sunt disponibile conform planului ales și configurării.</p><p style="font-size:13px;line-height:1.5;color:#6a7d80;margin:0 0 22px">Linkul este valabil 24 de ore. Dacă nu dorești să continui, poți ignora acest email.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 26px"><tr><td align="center" bgcolor="#168e92" style="border-radius:10px"><a href="${safe(input.ctaUrl)}" style="display:inline-block;padding:16px 28px;font-size:16px;font-weight:bold;color:#fff;text-decoration:none">${safe(cta)}</a></td></tr></table><p style="font-size:12px;color:#738689;word-break:break-all;text-align:center">Dacă butonul nu funcționează: <a href="${safe(input.ctaUrl)}" style="color:#168e92">${safe(input.ctaUrl)}</a></p></td></tr><tr><td style="padding:20px 48px;border-top:1px solid #e5efee;font-size:12px;color:#738689">BookEasy · <a href="mailto:contact@bookeasy.ro" style="color:#168e92">contact@bookeasy.ro</a> · <a href="tel:+40712345002" style="color:#168e92">+40 712 345 002</a></td></tr></table></td></tr></table></body></html>`
 return {text,html}
}
