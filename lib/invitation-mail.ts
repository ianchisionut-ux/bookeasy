import {Resend} from 'resend'
export function escapeEmail(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}
export function invitationEmail(subject:string,message:string,ctaLabel='',ctaUrl=''){
 const safe=(s:string)=>escapeEmail(s)
 return {text:`${subject}\n\n${message}${ctaUrl?'\n\n'+ctaLabel+': '+ctaUrl:''}\n\nBookEasy · contact@bookeasy.ro · +40 712 345 002`,html:`<!doctype html><html lang="ro"><body style="margin:0;background:#f3f7f7;font-family:Arial,sans-serif;color:#263b3f"><div style="max-width:560px;margin:24px auto;background:#fff;padding:28px;border-radius:16px"><img src="https://bookeasy.ro/logo.png" width="150" alt="BookEasy"><h1 style="font-size:24px">${safe(subject)}</h1><div style="font-size:16px;line-height:1.7;white-space:pre-wrap">${safe(message)}</div>${ctaUrl?`<p style="margin-top:24px"><a href="${safe(ctaUrl)}" style="background:#087f83;color:white;padding:13px 22px;border-radius:8px;text-decoration:none;display:inline-block">${safe(ctaLabel||'Află mai multe')}</a></p>`:''}<hr style="margin-top:30px;border:0;border-top:1px solid #e3eded"><p style="font-size:12px;color:#64748b">BookEasy · <a href="mailto:contact@bookeasy.ro">contact@bookeasy.ro</a> · <a href="tel:+40712345002">+40 712 345 002</a></p></div></body></html>`}
}
export class MailRejected extends Error{}
export async function sendInvitationMail(input:{to:string;subject:string;message:string;ctaLabel?:string;ctaUrl?:string;idempotencyKey:string;content?:{text:string;html:string}}){
 if(!process.env.RESEND_API_KEY)throw Error('Trimiterea emailurilor nu este configurată.')

 const result=await new Resend(process.env.RESEND_API_KEY).emails.send({from:'BookEasy <contact@bookeasy.ro>',replyTo:'contact@bookeasy.ro',to:input.to,subject:input.subject,...(input.content??invitationEmail(input.subject,input.message,input.ctaLabel,input.ctaUrl))},{idempotencyKey:input.idempotencyKey})
 if(result.error){const message='Resend nu a acceptat emailul. Verifică domeniul, limita de trimitere și adresa destinatarului.';if(result.error.name==='application_error')throw Error(message);throw new MailRejected(message)}
 if(!result.data?.id)throw Error('Trimiterea emailului nu a fost confirmată.')
 return result.data.id
}
