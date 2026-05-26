import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class OllamaAdapter implements AIAdapter {
  readonly name = 'ollama'

  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`)
    if (!res.ok) return []
    const data = await res.json() as { models: Array<{ name: string }> }
    return data.models.map(m => ({ id: m.name, name: m.name }))
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    const model = req.model || this.defaultModel
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: req.messages,
        stream: true,
      }),
    })

    if (!res.ok || !res.body) {
      yield { type: 'error', message: `Ollama responded with ${res.status}` }
      return
    }

    const decoder = new TextDecoder()
    const reader = res.body.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const json = JSON.parse(line) as {
              message?: { content?: string }
              done?: boolean
            }
            if (json.message?.content) {
              yield { type: 'text_delta', content: json.message.content }
            }
            if (json.done) {
              yield { type: 'done' }
              return
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  estimateCredits(_req: AIRequest): number {
    return 0
  }
}
