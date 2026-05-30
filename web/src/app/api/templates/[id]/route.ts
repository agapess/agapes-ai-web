import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { templates, projects, pages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateId, slugify } from '@/lib/utils'
import { z } from 'zod'

type Params = { params: { id: string } }

const cloneSchema = z.object({
  projectName: z.string().min(1).max(100),
})

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = db.select().from(templates).where(eq(templates.id, params.id)).get()
  if (!template || (!template.isPublic && template.createdBy !== session.user.id)) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = cloneSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const projectId = generateId()
  db.insert(projects).values({
    id: projectId,
    userId: session.user.id,
    name: parsed.data.projectName,
    slug: slugify(parsed.data.projectName),
    description: template.description ?? null,
  }).run()

  const pagesSnapshot = (Array.isArray(template.pagesSnapshot)
    ? template.pagesSnapshot
    : JSON.parse(template.pagesSnapshot as string)) as Array<{
    name: string; slug: string; content: string; isHomePage: boolean; order: number
  }>

  for (const page of pagesSnapshot) {
    db.insert(pages).values({
      id: generateId(),
      projectId,
      name: page.name,
      slug: page.slug,
      order: page.order,
      content: page.content as unknown as [],
      isHomePage: page.isHomePage,
    }).run()
  }

  db.update(templates)
    .set({ usageCount: template.usageCount + 1 })
    .where(eq(templates.id, params.id))
    .run()

  return NextResponse.json({ projectId }, { status: 201 })
}
