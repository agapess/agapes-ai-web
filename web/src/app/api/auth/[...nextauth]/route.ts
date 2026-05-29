import '@/lib/migrate'
import { seedDefaultProviders, seedDefaultTemplates } from '@/lib/seed'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

seedDefaultProviders()

// Seed starter templates using the first admin user as author.
// Safe to call every startup — seedDefaultTemplates is idempotent.
const firstAdmin = db.select({ id: users.id })
  .from(users)
  .where(eq(users.role, 'admin'))
  .get()

if (firstAdmin) {
  seedDefaultTemplates(firstAdmin.id)
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
