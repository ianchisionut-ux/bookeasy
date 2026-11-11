import { randomUUID } from 'node:crypto'
import { prisma } from './prisma'
export type HelpThread={id:string;businessId:string;businessName:string;subject:string;status:string;createdAt:Date;unread:boolean}
export type HelpMessage={id:string;sender:'BUSINESS'|'ADMIN';text:string;createdAt:Date}
export async function helpUnreadCount(businessId?:string) {
 const rows=businessId?await prisma.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "SupportTicket" WHERE "businessId"=${businessId} AND "businessUnread"`:await prisma.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "SupportTicket" WHERE "adminUnread"`
 return Number(rows[0]?.count??0)
}
export async function helpThreads(businessId?:string) {
 return businessId?prisma.$queryRaw<HelpThread[]>`SELECT t."id",t."businessId",b."name" AS "businessName",t."subject",t."status",t."createdAt",t."businessUnread" AS unread FROM "SupportTicket" t JOIN "Business" b ON b."id"=t."businessId" WHERE t."businessId"=${businessId} ORDER BY t."createdAt" DESC LIMIT 100`:prisma.$queryRaw<HelpThread[]>`SELECT t."id",t."businessId",b."name" AS "businessName",t."subject",t."status",t."createdAt",t."adminUnread" AS unread FROM "SupportTicket" t JOIN "Business" b ON b."id"=t."businessId" ORDER BY t."createdAt" DESC LIMIT 300`
}
export async function helpMessages(ticketId:string,businessId?:string) {
 const ticket=await prisma.supportTicket.findFirst({where:{id:ticketId,...(businessId?{businessId}:{})},select:{id:true}})
 if(!ticket)return null
 const rows=await prisma.$queryRaw<HelpMessage[]>`SELECT "id","sender","text","createdAt" FROM "SupportChatMessage" WHERE "ticketId"=${ticketId} ORDER BY "createdAt" DESC,"id" DESC LIMIT 200`
 return rows.reverse()
}
export async function sendHelpMessage(input:{ticketId?:string;businessId?:string;admin:boolean;text:string;requestId:string}) {
 return prisma.$transaction(async tx=>{
  // Serialize retries and concurrent sends within an account, without trusting a client-supplied business ID.
  const target=input.ticketId?await tx.supportTicket.findFirst({where:{id:input.ticketId,...(input.businessId?{businessId:input.businessId}:{})}}):null
  if(input.ticketId&&!target)throw Error('not_found')
  const businessId=target?.businessId??input.businessId
  if(!businessId)throw Error('not_found')
  if(!target&&!await tx.business.findUnique({where:{id:businessId},select:{id:true}}))throw Error('not_found')
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`help:${businessId}`}))`
  const previous=await tx.$queryRaw<{ticketId:string}[]>`SELECT m."ticketId" FROM "SupportChatMessage" m JOIN "SupportTicket" t ON t."id"=m."ticketId" WHERE t."businessId"=${businessId} AND m."requestId"=${input.requestId} AND m."sender"=${input.admin?'ADMIN':'BUSINESS'} LIMIT 1`
  if(previous.length)return previous[0].ticketId
  const ticket=target??await tx.supportTicket.create({data:{businessId,subject:input.text.slice(0,100),message:input.text}})
  if(input.admin&&!target)await tx.$executeRaw`UPDATE "SupportTicket" SET "adminUnread"=false WHERE "id"=${ticket.id}`
  const id=randomUUID(),sender=input.admin?'ADMIN':'BUSINESS'
  await tx.$executeRaw`INSERT INTO "SupportChatMessage" ("id","ticketId","sender","text","requestId","createdAt") VALUES (${id},${ticket.id},${sender},${input.text},${input.requestId},clock_timestamp())`
  if(input.admin)await tx.$executeRaw`UPDATE "SupportTicket" SET "reply"=${input.text},"repliedAt"=clock_timestamp(),"status"='IN_PROGRESS',"businessUnread"=true WHERE "id"=${ticket.id}`
  else await tx.$executeRaw`UPDATE "SupportTicket" SET "status"='NEW',"adminUnread"=true WHERE "id"=${ticket.id}`
  return ticket.id
 },{timeout:15000})
}
export async function markHelpRead(ticketId:string,lastId:string,admin:boolean,businessId?:string) {
 return prisma.$transaction(async tx=>{
  const ticket=await tx.supportTicket.findFirst({where:{id:ticketId,...(businessId?{businessId}:{})},select:{id:true,businessId:true}})
  if(!ticket)return false
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`help:${ticket.businessId}`}))`
  const latest=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "SupportChatMessage" WHERE "ticketId"=${ticketId} ORDER BY "createdAt" DESC,"id" DESC LIMIT 1`
  if(latest[0]?.id!==lastId)return true
  if(admin)await tx.$executeRaw`UPDATE "SupportTicket" SET "adminUnread"=false,"status"=CASE WHEN "status"='NEW' THEN 'IN_PROGRESS'::"SupportTicketStatus" ELSE "status" END WHERE "id"=${ticketId}`
  else await tx.$executeRaw`UPDATE "SupportTicket" SET "businessUnread"=false WHERE "id"=${ticketId} AND "businessId"=${businessId!}`
  return true
 })
}
// Called only after Super Admin authorization and explicit confirmation in the route.
export async function deleteHelpThread(ticketId:string) {
 return prisma.$transaction(async tx=>{
  const ticket=await tx.supportTicket.findUnique({where:{id:ticketId},select:{businessId:true}})
  if(!ticket)return false
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`help:${ticket.businessId}`}))`
  const deleted=await tx.supportTicket.deleteMany({where:{id:ticketId}})
  // SupportChatMessage rows cascade with the ticket, including all legacy message copies.
  return deleted.count>0
 })
}
