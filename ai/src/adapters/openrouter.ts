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
    // A 401 means the key is wrong — the service is reachable but auth fails.
    // Return true so the adapter is used and the user gets a clear 401 error message
    // from the stream(), rather than a generic "provider not reachable" message.
    if (!this.apiKey || this.apiKey.length < 20) return false
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      // 401 = reachable but wrong key — treat as available so stream() gives better error
      return res.ok || res.status === 401
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
      let detail = ''
      try { detail = await res.text() } catch { /* ignore */ }
      if (res.status === 401) {
        yield { type: 'error', message: `OpenRouter API key is invalid or was saved incorrectly. Go to Admin → Providers, delete this provider, and re-add it with the correct API key (should start with sk-or-v1- and be ~73 characters). Details: ${detail}` }
      } else {
        yield { type: 'error', message: `OpenRouter responded with ${res.status}: ${detail}` }
      }
      return
    }

    yield* streamOpenAICompat(res.body)
  }

  estimateCredits(req: AIRequest): number {
    const inputChars = req.messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.max(1, Math.ceil(inputChars / 500))
  }
}
