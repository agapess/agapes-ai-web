import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { templates, projects, pages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { z } from 'zod'

export async function GET() {
  const publicTemplates = db.select({
    id: templates.id,
    name: templates.name,
    description: templates.description,
    category: templates.category,
    previewCode: templates.previewCode,
    usageCount: templates.usageCount,
  }).from(templates)
    .where(eq(templates.isPublic, true))
    .all()
    .sort((a, b) => b.usageCount - a.usageCount)

  return NextResponse.json({ templates: publicTemplates })
}

const createTemplateSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['landing', 'saas', 'portfolio', 'ecommerce', 'dashboard', 'other']).optional().default('other'),
  isPublic: z.boolean().optional().default(true),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const project = db.select().from(projects).where(eq(projects.id, parsed.data.projectId)).get()
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const projectPages = db.select().from(pages)
    .where(eq(pages.projectId, parsed.data.projectId))
    .all()
    .sort((a, b) => a.order - b.order)

  const pagesSnapshot = projectPages.map(p => ({
    name: p.name,
    slug: p.slug,
    content: typeof p.content === 'string' ? p.content : '',
    isHomePage: p.isHomePage,
    order: p.order,
  }))

  const homePage = projectPages.find(p => p.isHomePage) ?? projectPages[0]
  const previewCode = typeof homePage?.content === 'string' ? homePage.content : ''

  const templateId = generateId()
  db.insert(templates).values({
    id: templateId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    previewCode,
    pagesSnapshot: JSON.stringify(pagesSnapshot),
    createdBy: session.user.id,
    isPublic: parsed.data.isPublic,
  }).run()

  return NextResponse.json({ templateId }, { status: 201 })
}
