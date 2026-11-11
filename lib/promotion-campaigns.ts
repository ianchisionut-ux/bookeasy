import type {Prisma} from '@prisma/client'
import {prisma} from './prisma'
import {FREE_CAMPAIGN_TERMS_VERSION} from './free-campaign-terms'
export type Promotion={id:string;code:string;name:string;freeMonths:number;freeUntilNotice:boolean;regularMinor:number;deletedAt:Date|null;enrollmentOpen:boolean;startsAt:Date|null;endsAt:Date|null;updatedAt:Date}
type DB=Pick<Prisma.TransactionClient,'$queryRaw'>
export const normalizePromoCode=(value:string)=>value.trim().toUpperCase()
export function promotionIsOpen(campaign:Promotion,now=new Date()){
 return !campaign.deletedAt&&campaign.enrollmentOpen&&(!campaign.startsAt||campaign.startsAt<=now)&&(!campaign.endsAt||now<campaign.endsAt)
}
export function promotionVersion(campaign:Pick<Promotion,'id'|'freeMonths'|'freeUntilNotice'|'regularMinor'>){return campaign.freeUntilNotice?FREE_CAMPAIGN_TERMS_VERSION+':'+campaign.id:`promo-v2:${campaign.id}:${campaign.freeMonths}:${campaign.regularMinor}`}
export async function findPromotion(value:string,db:DB=prisma){
 const rows=await db.$queryRaw<Promotion[]>`SELECT * FROM "LaunchCampaign" WHERE "code"=${normalizePromoCode(value)} LIMIT 1`
 return rows[0]??null
}
export async function hasOpenPromotion(db:DB=prisma){
 const rows=await db.$queryRaw<{open:boolean}[]>`SELECT EXISTS(SELECT 1 FROM "LaunchCampaign" WHERE "code" IS NOT NULL AND "deletedAt" IS NULL AND "enrollmentOpen" AND ("startsAt" IS NULL OR "startsAt"<=CURRENT_TIMESTAMP) AND ("endsAt" IS NULL OR "endsAt">CURRENT_TIMESTAMP)) AS open`
 return rows[0]?.open??false
}
export async function listPromotions(){return prisma.$queryRaw<(Promotion&{enrollments:number})[]>`SELECT c.*,count(e."id")::integer AS enrollments FROM "LaunchCampaign" c LEFT JOIN "LaunchEnrollment" e ON e."campaignId"=c."id" WHERE c."code" IS NOT NULL AND c."deletedAt" IS NULL GROUP BY c."id" ORDER BY c."updatedAt" DESC`}
