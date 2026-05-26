import { eq } from 'drizzle-orm'
import { db } from './db'
import { aiProviderConfigs } from './schema'
import { generateId } from './utils'

export function seedDefaultProviders(): void {
  const existing = db.select().from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.scope, 'platform'))
    .get()

  if (existing) return

  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const defaultModel = process.env.DEFAULT_MODEL ?? 'llama3.2'

  db.insert(aiProviderConfigs).values({
    id: generateId(),
    scope: 'platform',
    provider: 'ollama',
    displayName: 'Ollama (Local)',
    baseUrl: ollamaUrl,
    model: defaultModel,
    isDefault: true,
    isActive: true,
    allowedPlans: JSON.stringify(['free', 'pro', 'enterprise']),
    creditCostPerRequest: 0,
  }).run()
}
