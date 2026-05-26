import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { aiProviderConfigs } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { upsertProviderConfigSchema } from '@ai-builder/shared'
import { generateId } from '@/lib/utils'
import { encrypt, getEncryptionSecret } from '@/lib/encryption'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = db.select({
    id: aiProviderConfigs.id,
    provider: aiProviderConfigs.provider,
    displayName: aiProviderConfigs.displayName,
    baseUrl: aiProviderConfigs.baseUrl,
    model: aiProviderConfigs.model,
    isDefault: aiProviderConfigs.isDefault,
    isActive: aiProviderConfigs.isActive,
    creditCostPerRequest: aiProviderConfigs.creditCostPerRequest,
  }).from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.scope, 'user'), eq(aiProviderConfigs.userId, session.user.id)))
    .all()

  return NextResponse.json({ configs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = upsertProviderConfigSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { provider, displayName, baseUrl, apiKey, model, isDefault, allowedPlans, creditCostPerRequest } = parsed.data
  const secret = getEncryptionSecret()
  const id = generateId()

  db.insert(aiProviderConfigs).values({
    id,
    scope: 'user',
    userId: session.user.id,
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
