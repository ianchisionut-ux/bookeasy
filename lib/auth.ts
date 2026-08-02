import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({ where: { email: credentials?.email as string } })
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
        token.businessId = (user as any).businessId
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      ;(session as any).businessId = token.businessId
      ;(session as any).role = token.role
      ;(session as any).isSuperAdmin = token.role === 'SUPER_ADMIN'
      return session
    },
  },
  pages: { signIn: '/login' },
})
