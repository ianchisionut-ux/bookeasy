import PromotionManager from './promotion-manager'
import {prisma} from '@/lib/prisma'
import {LaunchCampaignSummary} from '@/components/launch-campaign-card'
import {LAUNCH_CAMPAIGN_ID} from '@/lib/launch-policy'
export const metadata={title:'Coduri promoționale | BookEasy'}
export default async function PromotionPage(){
 const [campaign,enrolled,configuring]=await Promise.all([
  prisma.launchCampaign.findUnique({where:{id:LAUNCH_CAMPAIGN_ID}}),
  prisma.launchEnrollment.count({where:{campaignId:LAUNCH_CAMPAIGN_ID}}),
  prisma.launchEnrollment.count({where:{campaignId:LAUNCH_CAMPAIGN_ID,activatedAt:null,cancelledAt:null}}),
 ])
 return <div className="dashboard-page"><h1 className="text-2xl font-semibold">Coduri promoționale</h1><p className="mb-6 mt-2 text-sm text-gray-500">Creează coduri pentru campaniile tale. Gratuitatea începe când afacerea finalizează configurarea; apoi se aplică abonamentul Standard de 55 lei/lună.</p>{campaign&&<LaunchCampaignSummary open={campaign.enrollmentOpen} enrolled={enrolled} configuring={configuring}/>}<PromotionManager key={String(campaign?.enrollmentOpen)}/></div>
}
