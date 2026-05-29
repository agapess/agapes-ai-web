import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import DashboardClient from './DashboardClient'

// Always fetch fresh data — prevents stale projects list when navigating back from builder
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const userProjects = db.select().from(projects)
    .where(eq(projects.userId, session.user.id))
    .all()

  return <DashboardClient initialProjects={userProjects} user={session.user} />
}
