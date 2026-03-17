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

---

## Manual Smoke Tests — Phase 8

Run against `pnpm dev` (localhost:3000). Mark ✅ pass or ❌ fail with notes.

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| S1 | Security headers present | DevTools → Network → any request → Response Headers | `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` visible |
| S2 | Feedback widget renders | Sign in → `/dashboard` | Fixed bottom-right button visible. Click → popover with form opens |
| S3 | Feedback form — short message rejected | Type 5 chars → Submit | Inline error: "Must be at least 10 characters" |
| S4 | Feedback form — valid submission | Type 20+ chars → Submit | Toast "Feedback sent!" Popover closes |
| S5 | Sentry no-crash | In browser console: `Sentry.captureException(new Error("test"))` | No JS errors thrown in browser |
| S6 | Rate limit on compare | Requires `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set. Submit compare form 21× quickly | 21st request returns 429 toast "Too many requests" |
| S7 | Lighthouse score | `pnpm build && pnpm start`, then `pnpm lhci autorun` | Performance ≥ 80, LCP < 2500ms, CLS < 0.1 (or warnings — not blocking) |
| S8 | CSP blocks unknown scripts | Browser console: `const s=document.createElement('script');s.src='https://evil.example.com/x.js';document.head.appendChild(s)` | CSP violation logged in console — script does not load |

> **S6:** No-op in local dev without Upstash vars. Defer to staging with vars set.
> **S7:** Run locally or let CI Lighthouse job report it.
