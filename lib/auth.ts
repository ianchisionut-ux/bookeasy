import NextAuth, { CredentialsSignin } from 'next-auth'
import { consumeNativeGoogleFlow } from './native-google-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { rateLimit } from './rate-limit'
import { cookies } from 'next/headers'
import { SUPERADMIN_BUSINESS_COOKIE } from './superadmin-business-access'
import { accountSessionRevoked } from './session-revocation'

class EmailNotVerified extends CredentialsSignin {
  code = 'email_not_verified'
}

// Nu folosim PrismaAdapter — cu Credentials + strategie JWT nu e nevoie de el,
// iar adapter-ul ar căuta tabele (Account, Session, VerificationToken) care
// nu există în schema noastră (avem doar User simplu, cu parolă hash-uită).
const nextAuth = NextAuth({
  // BookEasy rulează în spatele proxy-ului Cloudflare. Hostul ajunge din
  // request, iar URL-ul public este controlat de configurația Worker-ului.
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, accountType: {}, nativeFlowId: {}, nativeVerifier: {} },
      async authorize(credentials, request) {
        if (credentials?.nativeFlowId || credentials?.nativeVerifier) {
          if (credentials.accountType !== 'customer') return null
          const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
          if (!(await rateLimit(`native-google-claim:${ip}`, 30, 5 * 60 * 1000)).allowed) return null
          const identity = await consumeNativeGoogleFlow(credentials.nativeFlowId, credentials.nativeVerifier)
          if (!identity) return null
          return identity
        }
        if (typeof credentials?.email !== 'string' || typeof credentials?.password !== 'string' || !credentials.password) return null
        const email = credentials.email.toLowerCase().trim()
        if (!email || email.length > 254) return null

        // protecție brute-force: max 8 încercări / 15 min per email, și separat per IP —
        // ca cineva să nu poată încerca mii de parole pe un cont, oricât ar avea răbdare
        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
        const emailCheck = await rateLimit(`login-email:${email}`, 8, 15 * 60 * 1000)
        const ipCheck = await rateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000)
        if (!emailCheck.allowed || !ipCheck.allowed) {
          throw new Error('Prea multe încercări. Așteaptă 15 minute și încearcă din nou.')
        }

        const accountKind = credentials.accountType === 'customer' ? 'CUSTOMER' : 'BUSINESS'
        const user = await prisma.user.findUnique({ where: { email_accountKind: { email, accountKind } } })
        if (!user) return null
        if ((user.role === 'CUSTOMER') !== (accountKind === 'CUSTOMER')) return null
        const valid = await bcrypt.compare(credentials?.password as string, user.password)
        if (!valid) return null
        if (accountKind === 'CUSTOMER' && user.emailVerificationRequired && !user.emailVerifiedAt) throw new EmailNotVerified()
        return { id: user.id, email: user.email, businessId: user.businessId, role: user.role } as any
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
    })] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') return profile?.email_verified === true && typeof profile?.sub === 'string' && typeof profile?.email === 'string'
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (user || account) token.accountSessionStartedAt = Date.now()
      if (account?.provider === 'google' && account.providerAccountId) {
        token.id = `google:${account.providerAccountId}`
        token.googleSub = account.providerAccountId
        token.businessId = null
        token.role = 'CUSTOMER'
        token.firstName = typeof profile?.given_name === 'string' ? profile.given_name : ''
        token.lastName = typeof profile?.family_name === 'string' ? profile.family_name : ''
        token.customerPhone = typeof profile?.phone_number === 'string' ? profile.phone_number : ''
      } else if (user) {
        token.id = (user as any).id
        token.businessId = (user as any).businessId
        token.role = (user as any).role
        token.googleSub = (user as any).googleSub ?? null
        token.firstName = (user as any).firstName ?? ''
        token.lastName = (user as any).lastName ?? ''
        token.customerPhone = (user as any).customerPhone ?? ''
      }
      if (await accountSessionRevoked(token)) return null
      return token
    },
    async session({ session, token }) {
      ;(session as any).userId = token.id
      ;(session as any).businessId = token.businessId
      ;(session as any).role = token.role
      ;(session as any).googleSub = token.googleSub
      ;(session as any).firstName = token.firstName
      ;(session as any).lastName = token.lastName
      ;(session as any).customerPhone = token.customerPhone
      ;(session as any).isSuperAdmin = token.role === 'SUPER_ADMIN'
      return session
    },
  },
  pages: { signIn: '/login', error: '/cont' },
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
