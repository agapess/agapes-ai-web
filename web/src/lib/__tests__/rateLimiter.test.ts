import { describe, it, expect } from 'vitest'
import { buildRateLimitKey, parseRateLimitConfig } from '../rateLimiter'

describe('rateLimiter utilities', () => {
  it('buildRateLimitKey formats correctly', () => {
    expect(buildRateLimitKey('user-123', 'minute')).toBe('rl:user-123:minute')
    expect(buildRateLimitKey('user-abc', 'hour')).toBe('rl:user-abc:hour')
  })

  it('parseRateLimitConfig returns defaults', () => {
    const cfg = parseRateLimitConfig()
    expect(cfg.minuteLimit).toBeGreaterThan(0)
    expect(cfg.hourLimit).toBeGreaterThan(cfg.minuteLimit)
  })
})
