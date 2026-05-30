import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, formSubmissions } from '@/lib/schema'
import { and, eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * POST /api/contact/[projectId] — public endpoint, accepts form submissions.
 * No auth required — any visitor can submit a contact form.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  // Basic project existence check (don't require user auth)
  const project = db.select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, params.projectId))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let data: Record<string, unknown>
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Sanitize: remove any keys with very long values
  const sanitized: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && k.length < 100) {
      sanitized[k] = v.slice(0, 2000)
    }
  }

  const pageId = req.nextUrl.searchParams.get('pageId') ?? undefined

  db.insert(formSubmissions).values({
    id: generateId(),
    projectId: params.projectId,
    pageId: pageId ?? null,
    data: sanitized as unknown as string,
    submittedAt: new Date(),
  }).run()

  return NextResponse.json({ success: true })
}

/**
 * GET /api/contact/[projectId] — authenticated owner only.
 * Returns last 50 submissions.
 */
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

  const submissions = db.select()
    .from(formSubmissions)
    .where(eq(formSubmissions.projectId, params.projectId))
    .orderBy(desc(formSubmissions.submittedAt))
    .limit(50)
    .all()

  return NextResponse.json({ submissions })
}
