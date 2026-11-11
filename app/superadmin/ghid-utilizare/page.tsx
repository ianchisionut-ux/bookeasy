import TutorialManager from './tutorial-manager'
import {usageTutorials} from '@/lib/usage-guide'
export default async function TutorialsAdminPage(){const entries=await usageTutorials(true);return <TutorialManager initial={entries.map(t=>({...t,publishedAt:t.publishedAt.toISOString()}))}/>}
