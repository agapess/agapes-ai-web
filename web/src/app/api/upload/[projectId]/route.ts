import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { writeFile, mkdir, readdir, stat } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// Max file size: 10 MB
const MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

/**
 * POST /api/upload/[projectId]
 * Body: multipart/form-data with field "file"
 * Returns: { url: string } — public URL the Sandpack preview can load
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify project ownership
  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: 'File type not allowed. Upload JPG, PNG, GIF, WebP or SVG.' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const ext = ALLOWED_TYPES[file.type]
  const filename = `${randomUUID()}.${ext}`

  // Store under public/uploads/<projectId>/
  const uploadDir = join(process.cwd(), 'public', 'uploads', params.projectId)
  await mkdir(uploadDir, { recursive: true })

  const bytes = await file.arrayBuffer()
  await writeFile(join(uploadDir, filename), Buffer.from(bytes))

  const url = `/uploads/${params.projectId}/${filename}`
  return NextResponse.json({ url, filename, originalName: file.name })
}

/**
 * GET /api/upload/[projectId]
 * Returns list of uploaded images for this project.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.userId, session.user.id)))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads', params.projectId)

  try {
    const files = await readdir(uploadDir)
    const images = await Promise.all(
      files
        .filter(f => /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(f))
        .map(async f => {
          const s = await stat(join(uploadDir, f))
          return {
            url: `/uploads/${params.projectId}/${f}`,
            filename: f,
            size: s.size,
            createdAt: s.birthtimeMs,
          }
        }),
    )
    // Newest first
    images.sort((a, b) => b.createdAt - a.createdAt)
    return NextResponse.json({ images })
  } catch {
    // Directory doesn't exist yet — no images uploaded
    return NextResponse.json({ images: [] })
  }
}
