# Phase 8 — Test Plan

## Unit Tests

### T1: `rate-limit.ts` — null when env vars absent
**File:** `src/lib/__tests__/rate-limit.test.ts`
**Covers:** `makeRatelimit` returns `null` when `UPSTASH_REDIS_REST_URL` is unset; `checkRateLimit(null, id)` returns `{ limited: false, retryAfter: 0 }`.
**Expected:** No Upstash connection attempted; always allows.

### T2: `POST /api/feedback` — Zod validation
**File:** `src/app/api/feedback/__tests__/feedback.test.ts`
**Covers:** Message < 10 chars → 422; message > 500 chars → 422; missing page → 422; valid payload → 201.
**Expected:** Schema rejects invalid input before DB insert.

### T3: `POST /api/feedback` — auth guard
**File:** `src/app/api/feedback/__tests__/feedback.test.ts`
**Covers:** Unauthenticated request → 401.
**Expected:** `auth()` returns no userId → early return 401.

### T4: `feedback` Drizzle schema — types
**File:** `src/lib/db/schema/__tests__/feedback.test.ts`
**Covers:** `Feedback` and `NewFeedback` inferred types have correct shape.
**Expected:** TypeScript types match schema columns.
