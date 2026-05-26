import { describe, it, expect } from 'vitest'
import { LMStudioAdapter } from '../lmstudio.js'
import { OpenAIAdapter } from '../openai.js'
import { ClaudeAdapter } from '../claude.js'
import { OpenRouterAdapter } from '../openrouter.js'

describe('LMStudioAdapter', () => {
  const adapter = new LMStudioAdapter('http://127.0.0.1:19999', 'test-model')
  it('has name lmstudio', () => expect(adapter.name).toBe('lmstudio'))
  it('estimateCredits returns 0', () => {
    expect(adapter.estimateCredits({ messages: [], model: 'x' })).toBe(0)
  })
  it('isAvailable returns false when unreachable', async () => {
    expect(await adapter.isAvailable()).toBe(false)
  })
})

describe('OpenAIAdapter', () => {
  const adapter = new OpenAIAdapter('sk-fake', 'gpt-4o-mini')
  it('has name openai', () => expect(adapter.name).toBe('openai'))
  it('estimateCredits returns > 0', () => {
    expect(adapter.estimateCredits({ messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o-mini' })).toBeGreaterThan(0)
  })
})

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter('sk-ant-fake', 'claude-3-haiku-20240307')
  it('has name claude', () => expect(adapter.name).toBe('claude'))
  it('estimateCredits returns > 0', () => {
    expect(adapter.estimateCredits({ messages: [{ role: 'user', content: 'hi' }], model: 'claude-3-haiku-20240307' })).toBeGreaterThan(0)
  })
})

describe('OpenRouterAdapter', () => {
  const adapter = new OpenRouterAdapter('sk-or-fake', 'meta-llama/llama-3-8b-instruct')
  it('has name openrouter', () => expect(adapter.name).toBe('openrouter'))
  it('estimateCredits returns > 0', () => {
    expect(adapter.estimateCredits({ messages: [{ role: 'user', content: 'hi' }], model: 'meta-llama/llama-3-8b-instruct' })).toBeGreaterThan(0)
  })
})
