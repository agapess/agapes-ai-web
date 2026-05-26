import Anthropic from '@anthropic-ai/sdk'
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class ClaudeAdapter implements AIAdapter {
  readonly name = 'claude'
  private client: Anthropic

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      })
      return true
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    return [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ]
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    const systemMessages = req.messages.filter(m => m.role === 'system')
    const chatMessages = req.messages.filter(m => m.role !== 'system')
    const system = systemMessages.map(m => m.content).join('\n') || undefined

    try {
      const stream = await this.client.messages.stream({
        model: req.model || this.defaultModel,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages: chatMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text_delta', content: event.delta.text }
        }
        if (event.type === 'message_stop') {
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
