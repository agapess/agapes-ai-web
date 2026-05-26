import { describe, it, expect } from 'vitest'
import { buildMessages } from '../contextBuilder.js'

describe('buildMessages', () => {
  it('includes a system message as first element', () => {
    const messages = buildMessages({ userMessage: 'hello', history: [], projectContext: undefined })
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('React')
  })

  it('appends history before the current user message', () => {
    const history = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'response' },
    ]
    const messages = buildMessages({ userMessage: 'second', history, projectContext: undefined })
    const userMessages = messages.filter(m => m.role === 'user')
    expect(userMessages[0].content).toBe('first')
    expect(userMessages[1].content).toBe('second')
  })

  it('includes projectContext in system message when provided', () => {
    const messages = buildMessages({ userMessage: 'hi', history: [], projectContext: 'CONTEXT_DATA' })
    expect(messages[0].content).toContain('CONTEXT_DATA')
  })

  it('last message is always the current user message', () => {
    const messages = buildMessages({ userMessage: 'build a navbar', history: [], projectContext: undefined })
    expect(messages[messages.length - 1].role).toBe('user')
    expect(messages[messages.length - 1].content).toBe('build a navbar')
  })
})
