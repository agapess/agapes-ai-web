import { streamOpenAICompat } from './lmstudio.js'
import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export class OpenRouterAdapter implements AIAdapter {
  readonly name = 'openrouter'

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      if (!res.ok) return []
      const data = await res.json() as { data: Array<{ id: string; name: string }> }
      return data.data.map(m => ({ id: m.id, name: m.name }))
    } catch {
      return []
    }
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    let res: Response
    try {
      res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://ai-website-builder',
          'X-Title': 'AI Website Builder',
        },
        body: JSON.stringify({
          model: req.model || this.defaultModel,
          messages: req.messages,
          stream: true,
        }),
      })
    } catch (err) {
      yield { type: 'error', message: `OpenRouter unreachable: ${String(err)}` }
      return
    }

    if (!res.ok || !res.body) {
      yield { type: 'error', message: `OpenRouter responded with ${res.status}` }
      return
    }

    yield* streamOpenAICompat(res.body)
  }

  estimateCredits(req: AIRequest): number {
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.max(1, Math.ceil(inputChars / 500))
  }
}
