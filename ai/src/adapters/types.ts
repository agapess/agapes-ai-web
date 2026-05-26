export interface Model {
  id: string
  name: string
  contextLength?: number
}

export interface AIRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model: string
  projectContext?: string
}

export type AIChunk =
  | { type: 'text_delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface AIAdapter {
  readonly name: string
  isAvailable(): Promise<boolean>
  listModels(): Promise<Model[]>
  stream(req: AIRequest): AsyncGenerator<AIChunk>
  estimateCredits(req: AIRequest): number
}
