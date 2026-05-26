import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { updateProjectSchema } from '@ai-builder/shared'

type Params = { params: { id: string } }

function getOwnedProject(userId: string, projectId: string) {
  return db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get()
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const project = getOwnedProject(session.user.id, params.id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ project })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const existing = getOwnedProject(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  db.update(projects).set({
    ...parsed.data,
    updatedAt: new Date(),
  }).where(eq(projects.id, params.id)).run()

  const updated = db.select().from(projects).where(eq(projects.id, params.id)).get()
  return NextResponse.json({ project: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const existing = getOwnedProject(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.delete(projects).where(eq(projects.id, params.id)).run()
  return new NextResponse(null, { status: 204 })
}
