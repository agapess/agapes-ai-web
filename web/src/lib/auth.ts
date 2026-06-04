import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import bcrypt from 'bcryptjs'
import { db } from './db'
import * as schema from './schema'
import { eq } from 'drizzle-orm'

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users as any,
    accountsTable: schema.accounts as any,
    sessionsTable: schema.sessions as any,
    verificationTokensTable: schema.verificationTokens as any,
  }) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = db.select().from(schema.users)
          .where(eq(schema.users.email, credentials.email))
          .get()
        if (!user || !user.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        const dbUser = db.select().from(schema.users)
          .where(eq(schema.users.id, user.id))
          .get()
        token.role = dbUser?.role ?? 'user'
        token.plan = dbUser?.plan ?? 'free'
        token.credits = dbUser?.credits ?? 0
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.plan = token.plan as string
        session.user.credits = token.credits as number
      }
      return session
    },
  },
}
