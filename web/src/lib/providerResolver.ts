import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { aiProviderConfigs } from './schema'
import { decrypt, getEncryptionSecret } from './encryption'

export interface ResolvedProvider {
  provider: string
  baseUrl?: string
  apiKey?: string
  model?: string
  creditCost: number
}

export function resolveProvider(userId: string, userPlan: string, preferredProvider?: string): ResolvedProvider | null {
  const secret = getEncryptionSecret()

  // 1. User's own configs
  const userConfigs = db.select().from(aiProviderConfigs)
    .where(and(
      eq(aiProviderConfigs.scope, 'user'),
      eq(aiProviderConfigs.userId, userId),
      eq(aiProviderConfigs.isActive, true),
    ))
    .all()

  const userDefault = userConfigs.find(c => preferredProvider ? c.provider === preferredProvider : c.isDefault)
    ?? userConfigs[0]

  if (userDefault) {
    return {
      provider: userDefault.provider,
      baseUrl: userDefault.baseUrl ?? undefined,
      apiKey: userDefault.apiKey ? (decrypt(userDefault.apiKey, secret) ?? undefined) : undefined,
      model: userDefault.model ?? undefined,
      creditCost: userDefault.creditCostPerRequest,
    }
  }

  // 2. Platform providers for user's plan
  const platformConfigs = db.select().from(aiProviderConfigs)
    .where(and(
      eq(aiProviderConfigs.scope, 'platform'),
      eq(aiProviderConfigs.isActive, true),
    ))
    .all()

  const eligible = platformConfigs.filter(c => {
    const plans = JSON.parse(c.allowedPlans as string) as string[]
    return plans.includes(userPlan)
  })

  const platformDefault = eligible.find(c => preferredProvider ? c.provider === preferredProvider : c.isDefault)
    ?? eligible[0]

  if (platformDefault) {
    return {
      provider: platformDefault.provider,
      baseUrl: platformDefault.baseUrl ?? undefined,
      apiKey: platformDefault.apiKey ? (decrypt(platformDefault.apiKey, secret) ?? undefined) : undefined,
      model: platformDefault.model ?? undefined,
      creditCost: platformDefault.creditCostPerRequest,
    }
  }

  return null
}
