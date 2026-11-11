import AcceptInvitation from './accept-invitation'
export const metadata={title:'Invitație pentru afacerea ta | BookEasy',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default async function InvitationPage({params}:{params:Promise<{token:string}>}){return <AcceptInvitation token={(await params).token}/>}
