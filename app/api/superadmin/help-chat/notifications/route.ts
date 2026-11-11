import {NextResponse} from 'next/server'
import {auth} from '@/lib/auth'
import {helpUnreadCount} from '@/lib/help-chat'
export async function GET(){const session=await auth();if(!(session as any)?.isSuperAdmin)return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json({supportUnread:await helpUnreadCount()},{headers:{'Cache-Control':'no-store'}})}
