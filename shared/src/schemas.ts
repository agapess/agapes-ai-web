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

export const chatRequestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1).max(10000),
  provider: z.enum(['ollama', 'lmstudio', 'openai', 'claude', 'gemini', 'openrouter', 'custom']).optional(),
  model: z.string().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
