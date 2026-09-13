import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { rateLimit } from './rate-limit'
import { cookies } from 'next/headers'
import { SUPERADMIN_BUSINESS_COOKIE } from './superadmin-business-access'

// Nu folosim PrismaAdapter — cu Credentials + strategie JWT nu e nevoie de el,
// iar adapter-ul ar căuta tabele (Account, Session, VerificationToken) care
// nu există în schema noastră (avem doar User simplu, cu parolă hash-uită).
const nextAuth = NextAuth({
  // BookEasy rulează în spatele proxy-ului Cloudflare. Hostul ajunge din
  // request, iar URL-ul public este controlat de configurația Worker-ului.
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = (credentials?.email as string)?.toLowerCase()?.trim()
        if (!email) return null

        // protecție brute-force: max 8 încercări / 15 min per email, și separat per IP —
        // ca cineva să nu poată încerca mii de parole pe un cont, oricât ar avea răbdare
        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
        const emailCheck = rateLimit(`login-email:${email}`, 8, 15 * 60 * 1000)
        const ipCheck = rateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000)
        if (!emailCheck.allowed || !ipCheck.allowed) {
          throw new Error('Prea multe încercări. Așteaptă 15 minute și încearcă din nou.')
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials?.password as string, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, businessId: user.businessId, role: user.role } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.businessId = (user as any).businessId
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      ;(session as any).userId = token.id
      ;(session as any).businessId = token.businessId
      ;(session as any).role = token.role
      ;(session as any).isSuperAdmin = token.role === 'SUPER_ADMIN'
      return session
    },
  },
  pages: { signIn: '/login' },
})

export const { handlers, signIn, signOut } = nextAuth

// Un Super Admin poate intra temporar în dashboard-ul unui business fără parola
// clientului. Cookie-ul este luat în calcul numai dacă JWT-ul confirmă rolul
// SUPER_ADMIN; pentru orice alt utilizator este ignorat complet.
export async function auth() {
  const session = await nextAuth.auth()
  if (!session || !(session as any).isSuperAdmin) return session

  const businessId = (await cookies()).get(SUPERADMIN_BUSINESS_COOKIE)?.value
  if (businessId) {
    ;(session as any).businessId = businessId
    ;(session as any).isImpersonatingBusiness = true
  }
  return session
}
