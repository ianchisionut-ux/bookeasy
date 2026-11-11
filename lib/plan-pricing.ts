import {prisma} from './prisma'
import type {PlanPrices} from './plan-pricing-display'
export {formatPlanPrice} from './plan-pricing-display'
export type {PlanPrices} from './plan-pricing-display'
export async function getPlanPrices(db:Pick<typeof prisma,'$queryRaw'>=prisma):Promise<PlanPrices>{
 const rows=await db.$queryRaw<{id:string;amountMinor:number|null;updatedAt:Date}[]>`SELECT * FROM "PlatformPlanPrice" ORDER BY "id"`
 const standard=rows.find(r=>r.id==='STANDARD'),pro=rows.find(r=>r.id==='PRO')
 if(standard?.amountMinor==null)throw Error('Tariful Standard nu este configurat.')
 return {standardMinor:standard.amountMinor,proMinor:pro?.amountMinor??null,version:rows.map(r=>r.id+':'+r.amountMinor+':'+r.updatedAt.toISOString()).join('|')}
}
