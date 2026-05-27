import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import DeployClient from './DeployClient'

export default async function DeploySettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = db.select({ settings: users.settings }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  const settings = (user?.settings as Record<string, unknown>) ?? {}
  const hasVercelToken = Boolean(settings.vercelToken)

  return <DeployClient hasVercelToken={hasVercelToken} />
}
