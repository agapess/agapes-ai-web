import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pages, projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

type Params = { params: { projectId: string; pageId: string } }

async function getOwnedPage(userId: string, projectId: string, pageId: string) {
  const project = db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get()
  if (!project) return null
  return db.select().from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .get()
}

const updatePageSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  content: z.string().optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await getOwnedPage(session.user.id, params.projectId, params.pageId)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updatePageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  db.update(pages).set({
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    // content is a mode:'json' column but we store JSX source strings,
    // so we cast via unknown to satisfy drizzle's type while keeping the raw string
    ...(parsed.data.content !== undefined ? { content: parsed.data.content as unknown as string } : {}),
    ...(parsed.data.seoTitle !== undefined ? { seoTitle: parsed.data.seoTitle } : {}),
    ...(parsed.data.seoDescription !== undefined ? { seoDescription: parsed.data.seoDescription } : {}),
    updatedAt: new Date(),
  }).where(eq(pages.id, params.pageId)).run()

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await getOwnedPage(session.user.id, params.projectId, params.pageId)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (page.isHomePage) {
    return NextResponse.json({ error: 'Cannot delete the home page' }, { status: 400 })
  }

  db.delete(pages).where(eq(pages.id, params.pageId)).run()
  return new NextResponse(null, { status: 204 })
}
