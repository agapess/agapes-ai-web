import { describe, it, expect } from 'vitest'
import { buildAdapter } from '../registry.js'

describe('buildAdapter', () => {
  it('returns OllamaAdapter for provider ollama', () => {
    const adapter = buildAdapter({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3.2' })
    expect(adapter.name).toBe('ollama')
  })

  it('returns LMStudioAdapter for provider lmstudio', () => {
    const adapter = buildAdapter({ provider: 'lmstudio', baseUrl: 'http://localhost:1234', model: 'test' })
    expect(adapter.name).toBe('lmstudio')
  })

  it('returns OpenAIAdapter for provider openai', () => {
    const adapter = buildAdapter({ provider: 'openai', apiKey: 'sk-fake', model: 'gpt-4o-mini' })
    expect(adapter.name).toBe('openai')
  })

  it('returns ClaudeAdapter for provider claude', () => {
    const adapter = buildAdapter({ provider: 'claude', apiKey: 'sk-ant-fake', model: 'claude-3-haiku-20240307' })
    expect(adapter.name).toBe('claude')
  })

  it('returns OpenRouterAdapter for provider openrouter', () => {
    const adapter = buildAdapter({ provider: 'openrouter', apiKey: 'sk-or-fake', model: 'meta-llama/llama-3-8b-instruct' })
    expect(adapter.name).toBe('openrouter')
  })

  it('falls back to lmstudio for custom with baseUrl', () => {
    const adapter = buildAdapter({ provider: 'custom', baseUrl: 'http://my-server:1234', model: 'custom-model' })
    expect(adapter.name).toBe('lmstudio')
  })
})
