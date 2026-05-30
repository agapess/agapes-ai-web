import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, pages, users } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import BuilderPage from './BuilderPage'

// Always fetch fresh data — never serve a cached builder page
export const dynamic = 'force-dynamic'

interface Props {
  params: { projectId: string }
}

export default async function BuilderRoute({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const project = db.select().from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) redirect('/dashboard')

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)
    .map(p => ({
      ...p,
      // Normalise content: drizzle mode:json defaults to [] for new pages
      content: typeof p.content === 'string' ? p.content : '',
    }))

  const user = db.select({ credits: users.credits }).from(users)
    .where(eq(users.id, session.user.id))
    .get()

  return (
    // Key on projectId forces a full React tree remount when switching projects.
    // This ensures Sandpack, the chat panel, and all stores start completely fresh.
    <BuilderPage
      key={params.projectId}
      project={{ ...project, settings: project.settings as Record<string, unknown> }}
      initialPages={projectPages.map(p => ({
          ...p,
          seoTitle: p.seoTitle ?? undefined,
          seoDescription: p.seoDescription ?? undefined,
        }))}
      initialCredits={user?.credits ?? 0}
    />
  )
}
