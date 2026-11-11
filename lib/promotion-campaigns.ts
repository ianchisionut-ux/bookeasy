import type {Prisma} from '@prisma/client'
import {prisma} from './prisma'
import {LAUNCH_CAMPAIGN_ID,LAUNCH_OFFER_VERSION} from './launch-policy'
export type Promotion={id:string;code:string;name:string;freeMonths:number;enrollmentOpen:boolean;startsAt:Date|null;endsAt:Date|null;updatedAt:Date}
type DB=Pick<Prisma.TransactionClient,'$queryRaw'>
export const normalizePromoCode=(value:string)=>value.trim().toUpperCase()
export function promotionIsOpen(campaign:Promotion,now=new Date()){
 return campaign.enrollmentOpen&&(!campaign.startsAt||campaign.startsAt<=now)&&(!campaign.endsAt||now<campaign.endsAt)
}
export function promotionVersion(campaign:Pick<Promotion,'id'|'freeMonths'>){return campaign.id===LAUNCH_CAMPAIGN_ID&&campaign.freeMonths===2?LAUNCH_OFFER_VERSION:`promo-v1:${campaign.id}:${campaign.freeMonths}:5500`}
export async function findPromotion(value:string,db:DB=prisma){
 const rows=await db.$queryRaw<Promotion[]>`SELECT * FROM "LaunchCampaign" WHERE "code"=${normalizePromoCode(value)} LIMIT 1`
 return rows[0]??null
}
export async function hasOpenPromotion(db:DB=prisma){
 const rows=await db.$queryRaw<{open:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "LaunchCampaign" WHERE "code" IS NOT NULL AND "enrollmentOpen" AND ("startsAt" IS NULL OR "startsAt"<=CURRENT_TIMESTAMP) AND ("endsAt" IS NULL OR "endsAt">CURRENT_TIMESTAMP)) AS open`
 return rows[0]?.open??false
}
export async function listPromotions(){return prisma.$queryRaw<(Promotion&{enrollments:number})[]>`SELECT c.*,count(e."id")::integer AS enrollments FROM "LaunchCampaign" c LEFT JOIN "LaunchEnrollment" e ON e."campaignId"=c."id" WHERE c."code" IS NOT NULL GROUP BY c."id" ORDER BY c."updatedAt" DESC`}
