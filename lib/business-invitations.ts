import {createHash,randomBytes,randomUUID} from 'node:crypto'
import bcrypt from 'bcryptjs'
import {getPlanPrices,formatPlanPrice} from './plan-pricing'
import {FREE_CAMPAIGN_TERMS} from './free-campaign-terms'
import {prisma} from './prisma'
import {launchSignupData} from './launch-campaign'
import {findPromotion,normalizePromoCode,promotionIsOpen} from './promotion-campaigns'
import {sendInvitationMail} from './invitation-mail'
import {businessInvitationEmail,validInvitationHeader} from './business-invitation-email'
export class InvitationError extends Error{constructor(message:string,public status=400){super(message)}}

function accountConflictMessage(role:string,businessId:string|null){
 if(role==='STAFF')return 'Adresa are deja un cont de membru al unei afaceri BookEasy. Lista „Afaceri” afișează afacerile, nu toate conturile de utilizator. Pentru un cont de proprietar, folosește o altă adresă.'
 if(role==='SUPER_ADMIN')return 'Adresa are deja un cont de super administrator BookEasy. Acest cont nu apare ca afacere și nu poate accepta invitația de proprietar cu aceeași adresă.'
 if(role==='OWNER'&&!businessId)return 'Adresa are un cont de proprietar fără o afacere asociată. Acest cont nu apare în lista „Afaceri”; contactează echipa BookEasy pentru verificarea contului înainte de a retrimite invitația.'
 return 'Adresa are deja un cont BookEasy incompatibil cu această invitație. Verifică tipul contului înainte de a continua.'
}

type Invitation={id:string;email:string;name:string;offeredPlan:InvitationPlan;promoCode:string|null;headerImageUrl:string|null;tokenHash:string;expiresAt:Date;acceptedAt:Date|null;revokedAt:Date|null;deletedAt:Date|null;businessId:string|null;sentAt:Date|null;attemptedAt:Date;lastError:string|null;createdAt:Date}
export type InvitationPlan = 'FREE' | 'STANDARD' | 'PRO' | 'CAMPAIGN'
const digest=(token:string)=>createHash('sha256').update(token).digest('hex')
export async function listInvitations(){return prisma.$queryRaw<Omit<Invitation,'tokenHash'>[]>`SELECT "id","email","name","offeredPlan","promoCode","headerImageUrl","expiresAt","acceptedAt","revokedAt","businessId","sentAt","lastError","createdAt" FROM "BusinessInvitation" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 200`}
export async function sendBusinessInvitation(email:string,name='',requestedPromoCode?:string,offeredPlan:InvitationPlan='STANDARD',requestedHeaderImageUrl?:string){
 if(!process.env.RESEND_API_KEY)throw new InvitationError('Trimiterea emailurilor nu este configurată.',503)
 const owner=await prisma.user.findUnique({where:{email_accountKind:{email,accountKind:'BUSINESS'}},select:{role:true,businessId:true}})
 if(owner&&(owner.role!=='OWNER'||!owner.businessId))throw new InvitationError(accountConflictMessage(owner.role,owner.businessId),409)
 if(owner&&(requestedPromoCode||offeredPlan!=='STANDARD'))throw new InvitationError('Pentru un cont existent, schimbă planul din administrarea afacerii.')
 if(offeredPlan==='CAMPAIGN'&&!requestedPromoCode)throw new InvitationError('Alege codul campaniei.')
 if(offeredPlan!=='CAMPAIGN'&&requestedPromoCode)throw new InvitationError('Codul promoțional se folosește doar pentru o invitație de tip Campanie.')
 if(requestedHeaderImageUrl&&!validInvitationHeader(requestedHeaderImageUrl))throw new InvitationError('Antetul invitației nu este valid.')
 const headerImageUrl=validInvitationHeader(requestedHeaderImageUrl)
 const promoCode=requestedPromoCode?normalizePromoCode(requestedPromoCode):null
 const campaign=promoCode?await findPromotion(promoCode):null
 if(promoCode&&(!campaign||!promotionIsOpen(campaign)))throw new InvitationError('Alege un cod promoțional activ înainte de trimiterea invitației.',409)
 const token=randomBytes(32).toString('hex'),hash=digest(token),id=randomUUID(),expires=new Date(Date.now()+24*60*60*1000)
 const invitation=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invitation:${email}`}))`
  const rows=await tx.$queryRaw<Invitation[]>`SELECT * FROM "BusinessInvitation" WHERE "email"=${email}`
  const old=rows[0];if(old?.attemptedAt&&Date.now()-old.attemptedAt.getTime()<60000)throw new InvitationError('Așteaptă un minut înainte să retrimiți invitația.',429)
  if(old){await tx.$executeRaw`UPDATE "BusinessInvitation" SET "name"=${name},"offeredPlan"=${offeredPlan},"promoCode"=${promoCode},"headerImageUrl"=${headerImageUrl},"tokenHash"=${hash},"expiresAt"=${expires},"acceptedAt"=NULL,"revokedAt"=NULL,"deletedAt"=NULL,"businessId"=${owner?.businessId??null},"lastError"=NULL,"sentAt"=NULL,"attemptedAt"=clock_timestamp() WHERE "id"=${old.id}`;return old.id}
  await tx.$executeRaw`INSERT INTO "BusinessInvitation" ("id","email","name","offeredPlan","promoCode","headerImageUrl","tokenHash","expiresAt","businessId") VALUES (${id},${email},${name},${offeredPlan},${promoCode},${headerImageUrl},${hash},${expires},${owner?.businessId??null})`;return id
 })
 const prices=await getPlanPrices()
 const offerDescription=owner?'Invitația nu modifică planul afacerii existente.':offeredPlan==='CAMPAIGN'&&campaign?campaign.freeUntilNotice?`Campania ${campaign.code}: ${FREE_CAMPAIGN_TERMS}`:`Invitația include campania ${campaign.code}: ${campaign.freeMonths} ${campaign.freeMonths===1?'lună gratuită':'luni gratuite'} după configurare și acces PRO cât timp campania este activă. După oferta gratuită, tariful este de ${formatPlanPrice(campaign.regularMinor)}. Oferta se aplică doar dacă o accepți în formular.`:offeredPlan==='FREE'?'Invitația oferă acces la planul FREE, fără abonament lunar.':offeredPlan==='PRO'?`Invitația oferă acces la planul PRO: ${formatPlanPrice(prices.proMinor)}. Oferta se confirmă la înrolare.`:`Invitația oferă acces la planul STANDARD, la tariful de ${formatPlanPrice(prices.standardMinor)} după configurare.`
 try{await sendInvitationMail({to:email,subject:'Descoperă BookEasy — invitație pentru afacerea ta',message:'',content:businessInvitationEmail({businessName:name,offerDescription,ctaUrl:`https://bookeasy.ro/invitatie-afacere/${token}`,existing:Boolean(owner),headerImageUrl}),idempotencyKey:`business-invite/${invitation}/${hash}`});await prisma.$executeRaw`UPDATE "BusinessInvitation" SET "sentAt"=clock_timestamp(),"lastError"=NULL WHERE "id"=${invitation} AND "tokenHash"=${hash}`}
 catch{await prisma.$executeRaw`UPDATE "BusinessInvitation" SET "lastError"='Trimiterea emailului nu a fost confirmată. Poți retrimite invitația.' WHERE "id"=${invitation} AND "tokenHash"=${hash}`;throw new InvitationError('Invitația a fost salvată, dar trimiterea emailului nu a fost confirmată. Poți retrimite după un minut.',503)}
 return invitation
}
export async function invitationDetails(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return null
 const rows=await prisma.$queryRaw<Invitation[]>`SELECT * FROM "BusinessInvitation" WHERE "tokenHash"=${digest(token)} LIMIT 1`,row=rows[0]
 if(!row||row.deletedAt||row.revokedAt||row.acceptedAt||row.expiresAt<=new Date())return null
 const owner=await prisma.user.findUnique({where:{email_accountKind:{email:row.email,accountKind:'BUSINESS'}},select:{role:true}})
 if(owner?.role&&owner.role!=='OWNER')return null
 return {email:row.email,name:row.name,offeredPlan:row.offeredPlan,promoCode:row.promoCode,prices:await getPlanPrices(),existing:Boolean(owner),expiresAt:row.expiresAt.toISOString()}
}
export async function acceptBusinessInvitation(token:string,input:{password?:string;acceptTerms?:boolean;promoCode?:string;acceptPromo?:boolean;offerVersion?:string;planPriceVersion?:string}){
 if(!/^[a-f0-9]{64}$/.test(token))throw new InvitationError('Invitația nu este validă.')
 const password=input.password?await bcrypt.hash(input.password,12):null
 return prisma.$transaction(async tx=>{
  const rows=await tx.$queryRaw<Invitation[]>`SELECT * FROM "BusinessInvitation" WHERE "tokenHash"=${digest(token)} FOR UPDATE`,row=rows[0]
  if(!row||row.deletedAt||row.revokedAt||row.acceptedAt||row.expiresAt<=new Date())throw new InvitationError('Invitația a expirat sau a fost deja folosită. Cere o invitație nouă.')
  const owner=await tx.user.findUnique({where:{email_accountKind:{email:row.email,accountKind:'BUSINESS'}}})
  if(owner){if(owner.role!=='OWNER'||!owner.businessId)throw new InvitationError(accountConflictMessage(owner.role,owner.businessId),409);await tx.user.update({where:{id:owner.id},data:{emailVerifiedAt:new Date()}});await tx.$executeRaw`UPDATE "BusinessInvitation" SET "acceptedAt"=clock_timestamp(),"businessId"=${owner.businessId} WHERE "id"=${row.id}`;return {existing:true}}
  if(!password||!input.acceptTerms)throw new InvitationError('Alege parola și acceptă condițiile abonamentului.')
  if(row.offeredPlan==='CAMPAIGN'&&normalizePromoCode(input.promoCode??'')!==row.promoCode)throw new InvitationError('Codul promoțional din invitație nu poate fi modificat.')
  if(row.offeredPlan!=='CAMPAIGN'&&input.promoCode)throw new InvitationError('Planul din invitație nu poate fi modificat prin cod promoțional.')
  const prices=await getPlanPrices(tx)
  if((row.offeredPlan==='STANDARD'||row.offeredPlan==='PRO')&&input.planPriceVersion!==prices.version)throw new InvitationError('Tarifele s-au actualizat. Reîncarcă pagina și verifică oferta.',409)
  const offer=row.offeredPlan==='CAMPAIGN'?await launchSignupData(row.promoCode??undefined,tx,input.offerVersion??''):row.offeredPlan==='FREE'?{planName:'Free',billingStatus:'GRATUIT' as const,billingAmount:0,billingSubtotal:0,launchEnrollment:undefined}:row.offeredPlan==='PRO'?{planName:'Pro',billingStatus:prices.proMinor===0?'GRATUIT' as const:'NEPLATIT' as const,billingAmount:prices.proMinor===null?null:prices.proMinor/100,billingSubtotal:prices.proMinor===null?null:Number((prices.proMinor/100/1.21).toFixed(6)),launchEnrollment:undefined}:await launchSignupData(undefined,tx)
  if(offer.launchEnrollment&&!input.acceptPromo)throw new InvitationError('Acceptă condițiile codului promoțional.')
  const business=await tx.business.create({data:{name:row.name||'Afacerea mea',slug:'afacere-'+randomBytes(6).toString('hex'),category:'SALON',categoryLocked:false,publicListed:false,onboardingStep:1,onboardingDone:false,...offer,users:{create:{email:row.email,password,role:'OWNER',emailVerificationRequired:true,emailVerifiedAt:new Date()}}}})
  await tx.$executeRaw`UPDATE "BusinessInvitation" SET "acceptedAt"=clock_timestamp(),"businessId"=${business.id} WHERE "id"=${row.id}`
  return {existing:false}
 },{timeout:20000})
}
