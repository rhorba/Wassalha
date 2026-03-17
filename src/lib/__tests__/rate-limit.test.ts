import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  it('returns { limited: false, retryAfter: 0 } when limiter is null', async () => {
    const result = await checkRateLimit(null, 'test-id')
    expect(result).toEqual({ limited: false, retryAfter: 0 })
  })
})

describe('rate-limit module initialization', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterEach(() => {
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
  })

  it('ratelimit instances are null when Upstash env vars are absent', async () => {
    // Re-import to test fresh initialization without env vars
    const { ratelimit } = await import('@/lib/rate-limit')
    // In test env, env vars are absent so all limiters are null
    expect(ratelimit.compare).toBeNull()
    expect(ratelimit.booking).toBeNull()
    expect(ratelimit.billing).toBeNull()
  })
})
