import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'published']).optional(),
  theme: z.record(z.unknown()).optional(),
})

export const providerConfigSchema = z.object({
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom']),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
})

export const chatRequestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1).max(10000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  providerConfig: providerConfigSchema.optional(),
  projectContext: z.string().optional(),
})

export const upsertProviderConfigSchema = z.object({
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom']),
  displayName: z.string().min(1).max(80),
  baseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  allowedPlans: z.array(z.enum(['free', 'pro', 'enterprise'])).optional().default(['free', 'pro', 'enterprise']),
  creditCostPerRequest: z.number().int().min(0).optional().default(0),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type ProviderConfigInput = z.infer<typeof providerConfigSchema>
export type UpsertProviderConfigInput = z.infer<typeof upsertProviderConfigSchema>
