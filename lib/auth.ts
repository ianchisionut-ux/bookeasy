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
        return { id: user.id, email: user.email, businessId: user.businessId } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.businessId = (user as any).businessId
      return token
    },
    async session({ session, token }) {
      ;(session as any).businessId = token.businessId
      return session
    },
  },
  pages: { signIn: '/login' },
})
