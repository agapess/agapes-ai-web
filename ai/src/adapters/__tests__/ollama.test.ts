import { describe, it, expect, beforeEach } from 'vitest'
import { OllamaAdapter } from '../ollama.js'

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter

  beforeEach(() => {
    adapter = new OllamaAdapter('http://localhost:11434', 'llama3.2')
  })

  it('has name ollama', () => {
    expect(adapter.name).toBe('ollama')
  })

  it('estimateCredits always returns 0 (local model)', () => {
    const req = {
      messages: [{ role: 'user' as const, content: 'hello' }],
      model: 'llama3.2',
    }
    expect(adapter.estimateCredits(req)).toBe(0)
  })

  it('isAvailable returns false when ollama is unreachable', async () => {
    const adapter = new OllamaAdapter('http://127.0.0.1:19999', 'llama3.2')
    const result = await adapter.isAvailable()
    expect(result).toBe(false)
  })
})
