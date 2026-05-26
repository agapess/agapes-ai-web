import OpenAI from 'openai'
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class OpenAIAdapter implements AIAdapter {
  readonly name = 'openai'
  private client: OpenAI

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    baseUrl?: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    })
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const res = await this.client.models.list()
      return res.data
        .filter(m => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3'))
        .map(m => ({ id: m.id, name: m.id }))
    } catch {
      return []
    }
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: req.model || this.defaultModel,
        messages: req.messages,
        stream: true,
      })

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) yield { type: 'text_delta', content: delta }
        if (chunk.choices[0]?.finish_reason === 'stop') {
          yield { type: 'done' }
          return
        }
      }
      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', message: String(err) }
    }
  }

  estimateCredits(req: AIRequest): number {
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.max(1, Math.ceil(inputChars / 500))
  }
}
