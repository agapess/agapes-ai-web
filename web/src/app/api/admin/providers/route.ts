import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { generateId } from '@/lib/utils'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const configs = db.select({
    id: aiProviderConfigs.id,
    provider: aiProviderConfigs.provider,
    displayName: aiProviderConfigs.displayName,
    baseUrl: aiProviderConfigs.baseUrl,
    model: aiProviderConfigs.model,
    isDefault: aiProviderConfigs.isDefault,
    isActive: aiProviderConfigs.isActive,
    allowedPlans: aiProviderConfigs.allowedPlans,
    creditCostPerRequest: aiProviderConfigs.creditCostPerRequest,
    createdAt: aiProviderConfigs.createdAt,
  }).from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.scope, 'platform'))
    .all()

  return NextResponse.json({ configs })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const secret = getEncryptionSecret()
  const { provider, displayName, baseUrl, apiKey, model, isDefault, allowedPlans, creditCostPerRequest } = parsed.data
  const id = generateId()

  // If this new provider is marked as default, clear all existing defaults first
  if (isDefault) {
    db.update(aiProviderConfigs)
      .set({ isDefault: false })
      .where(eq(aiProviderConfigs.scope, 'platform'))
      .run()
  }

  db.insert(aiProviderConfigs).values({
    id,
    scope: 'platform',
    provider,
    displayName,
    baseUrl: baseUrl || null,
    apiKey: apiKey ? encrypt(apiKey, secret) : null,
    model: model || null,
    isDefault: isDefault ?? false,
    isActive: true,
    allowedPlans: JSON.stringify(allowedPlans),
    creditCostPerRequest: creditCostPerRequest ?? 0,
  }).run()

  return NextResponse.json({ id }, { status: 201 })
}
