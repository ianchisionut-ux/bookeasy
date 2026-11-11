export type PlanPrices={standardMinor:number;proMinor:number|null;version:string}
export const formatPlanPrice=(minor:number|null)=>minor===null?'La cerere':new Intl.NumberFormat('ro-RO',{maximumFractionDigits:2}).format(minor/100)+' lei/lună'
