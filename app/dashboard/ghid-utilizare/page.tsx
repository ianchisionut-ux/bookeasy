import TutorialVideo from '@/components/tutorial-video'
import GuideSeenMarker from '@/components/guide-seen-marker'
import {usageTutorials} from '@/lib/usage-guide'
import {BookOpen} from 'lucide-react'
export const metadata={title:'Ghid de utilizare | BookEasy'}
export default async function UsageGuidePage(){
 const entries=await usageTutorials()
 return <main className="dashboard-page"><GuideSeenMarker version={entries[0]?.publishedAt.toISOString()??null}/><header className="mb-6"><h1 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen size={25}/>Ghid de utilizare</h1><p className="mt-2 text-sm text-gray-500">Tutoriale pas cu pas pentru configurarea și folosirea BookEasy. Alege un videoclip și urmărește-l aici sau pe tot ecranul.</p></header><div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{entries.map(entry=><section key={entry.id} id={entry.id==='blocare-calendar'?'calendar':entry.id} className="card flex min-w-0 flex-col overflow-hidden p-4 sm:p-5"><header className="mb-4 sm:min-h-24"><h2 className="text-lg font-semibold">{entry.title}</h2>{entry.description&&<p className="mt-1 text-sm text-gray-500">{entry.description}</p>}</header><TutorialVideo entry={entry}/></section>)}</div>{!entries.length&&<p className="text-sm text-gray-500">Tutorialele vor apărea aici.</p>}</main>
}
