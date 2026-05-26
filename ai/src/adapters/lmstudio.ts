import type { AIAdapter, AIChunk, AIRequest, Model } from './types.js'

export class LMStudioAdapter implements AIAdapter {
  readonly name = 'lmstudio'

  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`)
      if (!res.ok) return []
      const data = await res.json() as { data: Array<{ id: string }> }
      return data.data.map(m => ({ id: m.id, name: m.id }))
    } catch {
      return []
    }
  }

  async *stream(req: AIRequest): AsyncGenerator<AIChunk> {
    const model = req.model || this.defaultModel
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: req.messages, stream: true }),
      })
    } catch (err) {
      yield { type: 'error', message: `LM Studio unreachable: ${String(err)}` }
      return
    }

    if (!res.ok || !res.body) {
      yield { type: 'error', message: `LM Studio responded with ${res.status}` }
      return
    }

    yield* streamOpenAICompat(res.body)
  }

  estimateCredits(_req: AIRequest): number {
    return 0
  }
}

export async function* streamOpenAICompat(body: ReadableStream<Uint8Array>): AsyncGenerator<AIChunk> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
          }
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield { type: 'text_delta', content: delta }
          if (json.choices?.[0]?.finish_reason === 'stop') {
            yield { type: 'done' }
            return
          }
        } catch {
          // skip unparseable line
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  yield { type: 'done' }
}
