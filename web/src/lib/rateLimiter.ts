import Redis from 'ioredis'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
    _redis.on('error', () => {
      // Fail open — rate limiter degrades gracefully when Redis is unavailable
    })
  }
  return _redis
}

export interface RateLimitConfig {
  minuteLimit: number
  hourLimit: number
}

export function parseRateLimitConfig(): RateLimitConfig {
  return {
    minuteLimit: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '5', 10),
    hourLimit: parseInt(process.env.RATE_LIMIT_PER_HOUR ?? '30', 10),
  }
}

export function buildRateLimitKey(userId: string, window: 'minute' | 'hour'): string {
  return `rl:${userId}:${window}`
}

export interface RateLimitResult {
  allowed: boolean
  remainingMinute: number
  remainingHour: number
  resetMinute: number
  resetHour: number
}

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const redis = getRedis()
  const cfg = parseRateLimitConfig()
  const now = Math.floor(Date.now() / 1000)

  if (!redis) {
    return {
      allowed: true,
      remainingMinute: cfg.minuteLimit,
      remainingHour: cfg.hourLimit,
      resetMinute: now + 60,
      resetHour: now + 3600,
    }
  }

  try {
    const minuteKey = buildRateLimitKey(userId, 'minute')
    const hourKey = buildRateLimitKey(userId, 'hour')

    const pipeline = redis.pipeline()
    pipeline.incr(minuteKey)
    pipeline.expire(minuteKey, 60)
    pipeline.incr(hourKey)
    pipeline.expire(hourKey, 3600)
    const results = await pipeline.exec()

    const minuteCount = (results?.[0]?.[1] as number) ?? 0
    const hourCount = (results?.[2]?.[1] as number) ?? 0

    const allowed = minuteCount <= cfg.minuteLimit && hourCount <= cfg.hourLimit

    return {
      allowed,
      remainingMinute: Math.max(0, cfg.minuteLimit - minuteCount),
      remainingHour: Math.max(0, cfg.hourLimit - hourCount),
      resetMinute: now + 60,
      resetHour: now + 3600,
    }
  } catch {
    return {
      allowed: true,
      remainingMinute: cfg.minuteLimit,
      remainingHour: cfg.hourLimit,
      resetMinute: now + 60,
      resetHour: now + 3600,
    }
  }
}
