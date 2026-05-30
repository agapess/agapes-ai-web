import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectHistory } from '@/lib/schema'
import { and, eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** GET /api/history/[projectId] — returns last 20 snapshots */
export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const project = db.select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const history = db.select()
    .from(projectHistory)
    .where(eq(projectHistory.projectId, params.projectId))
    .orderBy(desc(projectHistory.createdAt))
    .limit(20)
    .all()

  return NextResponse.json({ history })
}

/** POST /api/history/[projectId] — save a snapshot */
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const project = db.select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { pageId?: string; content?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { pageId, content, description = 'AI generation' } = body
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  // Store { pageId, content } as the snapshot JSON
  const snapshot = { pageId, content }

  db.insert(projectHistory).values({
    id: generateId(),
    projectId: params.projectId,
    snapshot: snapshot as unknown as string,
    description,
    createdBy: session.user.id,
    createdAt: new Date(),
  }).run()

  // Prune to keep only last 20 per project
  const all = db.select({ id: projectHistory.id })
    .from(projectHistory)
    .where(eq(projectHistory.projectId, params.projectId))
    .orderBy(desc(projectHistory.createdAt))
    .all()

  if (all.length > 20) {
    const toDelete = all.slice(20).map(r => r.id)
    for (const id of toDelete) {
      db.delete(projectHistory).where(eq(projectHistory.id, id)).run()
    }
  }

  return NextResponse.json({ ok: true })
}
