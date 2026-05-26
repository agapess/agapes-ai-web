export type UserRole = 'user' | 'admin'
export type UserPlan = 'free' | 'pro' | 'enterprise'
export type ProjectStatus = 'draft' | 'published'
export type AIProvider = 'ollama' | 'lmstudio' | 'openai' | 'claude' | 'gemini' | 'openrouter' | 'custom'
export type AIJobType = 'generate' | 'edit' | 'export' | 'deploy'
export type AIJobStatus = 'queued' | 'running' | 'done' | 'failed'
export type ProviderScope = 'platform' | 'user'

export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  credits: number
  plan: UserPlan
  stripeCustomerId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  userId: string
  name: string
  slug: string
  description: string | null
  theme: Record<string, unknown>
  settings: Record<string, unknown>
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export interface Page {
  id: string
  projectId: string
  name: string
  slug: string
  order: number
  content: ComponentNode[]
  seoTitle: string | null
  seoDescription: string | null
  isHomePage: boolean
  updatedAt: Date
}

export interface ComponentNode {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentNode[]
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface AIProviderConfig {
  id: string
  scope: ProviderScope
  userId: string | null
  provider: AIProvider
  displayName: string
  baseUrl: string | null
  model: string | null
  isDefault: boolean
  isActive: boolean
  allowedPlans: UserPlan[]
  creditCostPerRequest: number
}

// SSE event types streamed from AI service → web → browser
export type AIStreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'code_block'; language: string; content: string }
  | { type: 'preview_update'; code: string }
  | { type: 'credits_deducted'; amount: number; remaining: number }
  | { type: 'error'; message: string }
  | { type: 'done' }
