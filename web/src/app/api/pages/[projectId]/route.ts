import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { z } from 'zod'

type Params = { params: { projectId: string } }

async function getOwnedProject(userId: string, projectId: string) {
  return db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get()
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOwnedProject(session.user.id, params.projectId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allPages = db.select().from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  return NextResponse.json({ pages: allPages })
}

const createPageSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getOwnedProject(session.user.id, params.projectId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = createPageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = db.select({ order: pages.order }).from(pages)
    .where(eq(pages.projectId, params.projectId))
    .all()
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(p => p.order)) : -1

  const slug = parsed.data.slug ?? parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const pageId = generateId()

  db.insert(pages).values({
    id: pageId,
    projectId: params.projectId,
    name: parsed.data.name,
    slug,
    order: maxOrder + 1,
    isHomePage: false,
  }).run()

  const page = db.select().from(pages).where(eq(pages.id, pageId)).get()
  return NextResponse.json({ page }, { status: 201 })
}
