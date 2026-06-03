import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import DashboardClient from './DashboardClient'

// Always fetch fresh data — prevents stale projects list when navigating back from builder
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const userProjects = db.select().from(projects)
    .where(eq(projects.userId, session.user.id))
    .all()

  // Load home page content for each project (for thumbnail previews)
  const projectsWithPreview = userProjects.map(p => {
    const homePage = db.select({ content: pages.content }).from(pages)
      .where(and(eq(pages.projectId, p.id), eq(pages.isHomePage, true)))
      .get()
    const raw = homePage?.content
    const previewCode = raw && typeof raw === 'string' && raw.trim().length > 50 ? raw : null
    return { ...p, previewCode }
  })

  return <DashboardClient initialProjects={projectsWithPreview} user={session.user} />
}
