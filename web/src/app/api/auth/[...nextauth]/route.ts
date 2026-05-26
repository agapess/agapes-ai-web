import '@/lib/migrate'
import { seedDefaultProviders } from '@/lib/seed'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

seedDefaultProviders()

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
