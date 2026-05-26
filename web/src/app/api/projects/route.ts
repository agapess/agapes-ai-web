import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, pages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { createProjectSchema } from '@ai-builder/shared'
import { generateId, slugify } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userProjects = db.select().from(projects)
    .where(eq(projects.userId, session.user.id))
    .all()

  return NextResponse.json({ projects: userProjects })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const projectId = generateId()
  const pageId = generateId()

  db.insert(projects).values({
    id: projectId,
    userId: session.user.id,
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    description: parsed.data.description ?? null,
  }).run()

  db.insert(pages).values({
    id: pageId,
    projectId,
    name: 'Home',
    slug: 'index',
    order: 0,
    isHomePage: true,
  }).run()

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  return NextResponse.json({ project }, { status: 201 })
}
