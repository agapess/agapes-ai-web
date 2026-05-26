import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { and, eq } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.userId, session.user.id)))
    .get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const secret = getEncryptionSecret()
  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.apiKey !== undefined) {
    updates.apiKey = parsed.data.apiKey ? encrypt(parsed.data.apiKey, secret) : null
  }
  if (parsed.data.allowedPlans !== undefined) {
    updates.allowedPlans = JSON.stringify(parsed.data.allowedPlans)
  }

  db.update(aiProviderConfigs).set(updates).where(eq(aiProviderConfigs.id, params.id)).run()
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  db.delete(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.id, params.id), eq(aiProviderConfigs.userId, session.user.id)))
    .run()
  return new NextResponse(null, { status: 204 })
}
