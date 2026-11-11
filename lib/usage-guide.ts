import { prisma } from './prisma'
export type UsageTutorial = {id:string;title:string;description:string;videoUrl:string;captionsUrl:string|null;posterUrl:string|null;duration:string;published:boolean;publishedAt:Date}
export function usageTutorials(admin=false) {
 return admin ? prisma.$queryRaw<UsageTutorial[]>`SELECT * FROM "UsageTutorial" ORDER BY "publishedAt" DESC,"id"` : prisma.$queryRaw<UsageTutorial[]>`SELECT * FROM "UsageTutorial" WHERE "published" ORDER BY "publishedAt" DESC,"id"`
}
export async function unreadGuideCount(businessId:string) {
 const rows=await prisma.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "UsageTutorial" t WHERE t."published" AND t."publishedAt">COALESCE((SELECT "seenAt" FROM "GuideSeen" WHERE "businessId"=${businessId}),'-infinity'::timestamptz)`
 return Number(rows[0]?.count??0)
}
export async function markGuideSeen(businessId:string,version:string) {
 const date=new Date(version)
 if(!Number.isFinite(date.getTime())||date.getTime()>Date.now()+1000)return false
 await prisma.$executeRaw`INSERT INTO "GuideSeen" ("businessId","seenAt") SELECT ${businessId},MAX("publishedAt") FROM "UsageTutorial" WHERE "published" AND "publishedAt"<=${date} HAVING MAX("publishedAt") IS NOT NULL ON CONFLICT ("businessId") DO UPDATE SET "seenAt"=GREATEST("GuideSeen"."seenAt",EXCLUDED."seenAt")`
 return true
}
