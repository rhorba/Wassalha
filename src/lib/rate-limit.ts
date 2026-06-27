import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy initialization — skips rate limiting if Upstash env vars are not set.
// This means rate limiting is a no-op in local dev and CI (no Upstash creds needed).
function makeRatelimit(
  requests: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
  prefix: string,
): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
  })
}

export const ratelimit = {
  compare:      makeRatelimit(20, '1 m', 'rl:compare'),
  compareBulk:  makeRatelimit(3,  '1 m', 'rl:compare-bulk'),
  booking:      makeRatelimit(10, '1 m', 'rl:booking'),
  billing:      makeRatelimit(5,  '1 m', 'rl:billing'),
}

/**
 * Check rate limit for an identifier (IP or userId).
 * Returns { limited: true } if the limit is exceeded, { limited: false } if allowed.
 * If limiter is null (no Upstash env vars), always returns { limited: false }.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ limited: boolean; retryAfter: number }> {
  if (!limiter) return { limited: false, retryAfter: 0 }
  try {
    const { success, reset } = await limiter.limit(identifier)
    return {
      limited: !success,
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    }
  } catch {
    // Upstash unreachable (placeholder creds / network error) — fail open
    return { limited: false, retryAfter: 0 }
  }
}
