# Phase 8 — Testing + Launch Design

**Date:** 2026-03-16
**Status:** Designed — ready for planning

---

## Overview

Phase 8 ships Wassalha to 20 beta retailers. Four parallel tracks:

1. **E2E Testing** — Playwright critical-path flows
2. **Performance** — Lighthouse CI gating + real-user CWV monitoring
3. **Security** — Automated headers, rate limiting, dependency audit
4. **Beta Launch Infra** — Sentry + PostHog + in-app feedback widget

All tracks are independent and can be implemented in parallel.

---

## Track 1 — E2E Testing (Playwright)

### Auth Strategy

Use `@clerk/testing/playwright` — bypasses Clerk hosted UI entirely.

- `clerkSetup()` called in `playwright.config.ts`
- `setupClerkTestingToken({ userId })` called per test to inject a session
- Two fixture users created once in Clerk Dashboard:
  - `E2E_RETAILER_USER_ID` — standard retailer role
  - `E2E_ADMIN_USER_ID` — admin role
- Both stored as GitHub Actions repo secrets + `.env.local` entries

### File Structure

```
e2e/
├── fixtures/
│   └── auth.ts              # shared helpers: retailerPage(), adminPage()
├── auth.spec.ts             # unauthenticated → redirects to /sign-in
├── onboarding.spec.ts       # new retailer → /onboarding → /dashboard
├── compare-book.spec.ts     # compare carriers → BookingSheet → confirm
├── tracking.spec.ts         # /shipments/[id] → timeline renders
└── admin-billing.spec.ts    # /admin/billing → generate invoice button
playwright.config.ts         # root — webServer, baseURL, clerkSetup
```

### Config

```ts
// playwright.config.ts
import { clerkSetup } from '@clerk/testing/playwright'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalSetup: clerkSetup,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

### Auth Fixture

```ts
// e2e/fixtures/auth.ts
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'

export async function asRetailer(page: Page) {
  await setupClerkTestingToken({ page, userId: process.env.E2E_RETAILER_USER_ID! })
}

export async function asAdmin(page: Page) {
  await setupClerkTestingToken({ page, userId: process.env.E2E_ADMIN_USER_ID! })
}
```

### Test Flows

| File | Flow | Key Assertions |
|------|------|----------------|
| `auth.spec.ts` | GET `/dashboard` unauthenticated | Redirects to `/sign-in` |
| `auth.spec.ts` | GET `/admin/carriers` as retailer | Redirects to `/dashboard` |
| `onboarding.spec.ts` | New user → `/onboarding` step 1→2→3 | Each step submits, done step CTA redirects |
| `compare-book.spec.ts` | Fill compare form → results render → open BookingSheet → confirm | Shipment created, success toast shown |
| `tracking.spec.ts` | Navigate to `/shipments/[id]` | Timeline renders, at least 1 status event visible |
| `admin-billing.spec.ts` | Admin visits `/admin/billing` → clicks "Generate Invoice" | Invoice row appears in table |

### CI Job

```yaml
# .github/workflows/ci.yml — new job added after vitest
e2e:
  needs: test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - run: pnpm install
    - run: pnpm exec playwright install chromium
    - run: pnpm test:e2e
  env:
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
    E2E_RETAILER_USER_ID: ${{ secrets.E2E_RETAILER_USER_ID }}
    E2E_ADMIN_USER_ID: ${{ secrets.E2E_ADMIN_USER_ID }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Track 2 — Performance (Core Web Vitals)

### Lighthouse CI (Gating)

Runs on PRs to `main` — blocks merge if thresholds regress.

```js
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['/', '/dashboard', '/compare', '/shipments'],
      startServerCommand: 'pnpm start',
      numberOfRuns: 2,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}
```

```yaml
# .github/workflows/ci.yml — lighthouse job
lighthouse:
  needs: build
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - run: pnpm install && pnpm build
    - run: pnpm exec lhci autorun
```

### Real-User Monitoring

- **`@vercel/speed-insights`** — `<SpeedInsights />` in `src/app/layout.tsx` (one import, zero config)
- **Sentry performance** — automatically captures LCP/INP/CLS via `@sentry/nextjs` (wired in Track 4)

### Known Fixes (applied during implementation)

| Issue | Fix |
|-------|-----|
| LCP on landing Hero | Add `priority` prop to `<Image>` in Hero component |
| CLS on dashboard KPI row | Wrap in `<Suspense>` with fixed-height skeleton |
| CLS on shipments table | Add `min-h` to table container during loading state |

---

## Track 3 — Security (Automated Tooling)

### Security Headers (`next-safe`)

```ts
// next.config.ts
import nextSafe from 'next-safe'

const securityHeaders = nextSafe({
  isDev: process.env.NODE_ENV !== 'production',
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://accounts.clerk.dev', 'https://js.stripe.com'],
    'connect-src': [
      "'self'",
      'https://*.clerk.dev',
      'https://*.supabase.co',
      'https://api.stripe.com',
      'https://app.posthog.com',
      'https://*.sentry.io',
    ],
    'frame-src': ["'self'", 'https://accounts.clerk.dev', 'https://js.stripe.com'],
    'img-src': ["'self'", 'data:', 'https://maps.googleapis.com'],
  },
})

export default {
  headers: async () => [{ source: '/(.*)', headers: securityHeaders }],
  // ... rest of config
}
```

### Rate Limiting (`@upstash/ratelimit`)

Upstash Redis free tier (10k req/day — sufficient for 20 beta retailers).

```ts
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = {
  compare: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'rl:compare',
  }),
  booking: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:booking',
  }),
  billing: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'rl:billing',
  }),
}
```

Usage in route handlers:
```ts
const { success } = await ratelimit.compare.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } })
```

Applied to:
- `POST /api/carriers/compare` — 20 req/min per IP
- `POST /api/shipments` — 10 req/min per user ID
- `POST /api/billing/invoices` — 5 req/min per user ID

### Dependency Audit (CI)

Added to lint job in `ci.yml`:
```yaml
- run: pnpm audit --audit-level=high
```

Fails build on high/critical CVEs. `pnpm audit --fix` used to resolve.

### New Environment Variables

```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Track 4 — Beta Launch Infra

### Sentry

```ts
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,        // 20% of transactions
  replaysOnErrorSampleRate: 1.0, // 100% on errors
  integrations: [Sentry.replayIntegration()],
})
```

- `withSentryConfig()` in `next.config.ts` — source maps uploaded + deleted post-build
- `sentry.server.config.ts` + `sentry.edge.config.ts` generated by `@sentry/wizard`
- Captures all unhandled API errors automatically

### PostHog

```tsx
// src/app/providers.tsx — add PostHogProvider
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: 'https://app.posthog.com',
  capture_pageview: true,
  capture_pageleave: true,
})
```

Zero manual event tracking for MVP — auto-capture covers the key funnels:
- Landing → Sign-up → Onboarding → Compare → Book

### In-App Feedback Widget

**Schema** — new `feedback` table (Migration 0007):

```ts
// src/lib/db/schema/feedback.ts
export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  message: text('message').notNull(),
  page: text('page').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**API** — `POST /api/feedback`:
- Auth required, Zod validates `{ message: z.string().min(10).max(500), page: z.string() }`
- Inserts row, returns `201`

**Component** — `<FeedbackButton />`:
- Fixed bottom-right, dashboard layout only (`src/app/(dashboard)/layout.tsx`)
- shadcn `Popover` — `<Textarea>` + "Send feedback" button
- `useMutation` — optimistic close on submit, toast on success/error
- Passes `window.location.pathname` as `page`

```tsx
// Placement in dashboard layout
<main>
  {children}
  <FeedbackButton />
</main>
```

Admin reads feedback via Drizzle Studio in week 1 — no admin UI needed for MVP.

---

## Data Flow Summary

```
User action → Rate limit check (Upstash) → API handler → Service layer → DB
                                                ↓
                                         Sentry captures errors
                                         PostHog captures events
```

---

## New Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright root config |
| `e2e/fixtures/auth.ts` | Clerk session helpers |
| `e2e/auth.spec.ts` | Auth redirect tests |
| `e2e/onboarding.spec.ts` | Onboarding flow |
| `e2e/compare-book.spec.ts` | Core booking flow |
| `e2e/tracking.spec.ts` | Tracking page |
| `e2e/admin-billing.spec.ts` | Admin billing flow |
| `lighthouserc.js` | Lighthouse CI thresholds |
| `sentry.client.config.ts` | Sentry client init |
| `sentry.server.config.ts` | Sentry server init |
| `sentry.edge.config.ts` | Sentry edge init |
| `src/lib/rate-limit.ts` | Upstash ratelimit instances |
| `src/lib/db/schema/feedback.ts` | Feedback table schema |
| `src/app/api/feedback/route.ts` | Feedback POST endpoint |
| `src/components/feedback/feedback-button.tsx` | Feedback widget |

## Modified Files

| File | Change |
|------|--------|
| `next.config.ts` | Add `nextSafe` headers + `withSentryConfig` |
| `src/app/layout.tsx` | Add `<SpeedInsights />` |
| `src/app/providers.tsx` | Add `PostHogProvider` |
| `src/app/(dashboard)/layout.tsx` | Add `<FeedbackButton />` |
| `src/app/api/carriers/compare/route.ts` | Add rate limit |
| `src/app/api/shipments/route.ts` | Add rate limit |
| `src/app/api/billing/invoices/route.ts` | Add rate limit |
| `src/lib/db/schema/index.ts` | Export `feedback` table |
| `.github/workflows/ci.yml` | Add E2E + Lighthouse jobs + audit |
| `.env.example` | Add Upstash + Sentry vars |

## New Environment Variables

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...

# PostHog (already in .env.example)
NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# E2E test users (Clerk)
E2E_RETAILER_USER_ID=user_...
E2E_ADMIN_USER_ID=user_...
```
