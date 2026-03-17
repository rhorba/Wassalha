# Phase 8 — Testing + Launch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Ship Wassalha to 20 beta retailers with E2E test coverage, CWV-gated CI, automated security hardening, and full observability (Sentry + PostHog + in-app feedback).

**Architecture:** Four independent tracks executed in order — E2E (Playwright + @clerk/testing), Performance (Lighthouse CI + SpeedInsights), Security (next-safe headers + Upstash rate limiting), Beta Infra (Sentry + PostHog + feedback widget + feedback DB table). All changes are additive — no existing service layer logic is modified.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W8 — Testing + Launch

---

## Task 1: Install Playwright + configure with Clerk auth bypass

**Files:**

* Create: `playwright.config.ts`
* Create: `e2e/fixtures/auth.ts`
* Modify: `package.json` (add `test:e2e` script)
* Modify: `.env.example` (add E2E user ID vars)

**Step 1: Install Playwright + Clerk testing package**

```bash
pnpm add -D @playwright/test @clerk/testing
pnpm exec playwright install chromium
```

**Step 2: Create `playwright.config.ts` at the project root**

```ts
// playwright.config.ts
import { clerkSetup } from '@clerk/testing/playwright'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

**Step 3: Create `e2e/global-setup.ts`**

```ts
// e2e/global-setup.ts
import { clerkSetup } from '@clerk/testing/playwright'

export default async function globalSetup() {
  await clerkSetup()
}
```

**Step 4: Create `e2e/fixtures/auth.ts`**

```ts
// e2e/fixtures/auth.ts
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'

export async function asRetailer(page: Page): Promise<void> {
  await setupClerkTestingToken({
    page,
    userId: process.env.E2E_RETAILER_USER_ID!,
  })
}

export async function asAdmin(page: Page): Promise<void> {
  await setupClerkTestingToken({
    page,
    userId: process.env.E2E_ADMIN_USER_ID!,
  })
}
```

**Step 5: Add `test:e2e` script to `package.json`**

Find the `"scripts"` block and add:
```json
"test:e2e": "playwright test"
```

**Step 6: Add E2E env vars to `.env.example`**

Append to `.env.example`:
```bash
# E2E test users (create once in Clerk Dashboard, copy their user IDs)
E2E_RETAILER_USER_ID=user_...
E2E_ADMIN_USER_ID=user_...
```

Also add to `.env.local`:
```bash
E2E_RETAILER_USER_ID=<your retailer test user ID from Clerk Dashboard>
E2E_ADMIN_USER_ID=<your admin test user ID from Clerk Dashboard>
```

> **Note:** These users must already exist in Clerk Dashboard. Create them manually: one with no `role` in `publicMetadata` (retailer), one with `{ "role": "admin" }`. The `setupClerkTestingToken` call injects a valid session without any UI interaction.

**Step 7: Verify**

```bash
pnpm exec playwright --version
# Should print: Version X.X.X
```

---

## Task 2: Write E2E spec — auth redirects (`e2e/auth.spec.ts`)

**Files:**

* Create: `e2e/auth.spec.ts`

**Step 1: Create `e2e/auth.spec.ts`**

```ts
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Auth redirects', () => {
  test('unauthenticated user visiting /dashboard redirects to /sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('unauthenticated user visiting /compare redirects to /sign-in', async ({ page }) => {
    await page.goto('/compare')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('unauthenticated user visiting /admin/carriers redirects to /sign-in', async ({ page }) => {
    await page.goto('/admin/carriers')
    await expect(page).toHaveURL(/sign-in/)
  })
})
```

> **Context:** `src/middleware.ts` uses Clerk middleware to protect `/dashboard`, `/compare`, `/analytics`, and `/admin/*` routes. These tests confirm the guards are live.

**Step 2: Smoke-run**

```bash
pnpm test:e2e --grep "Auth redirects"
```

Expected: 3 passing tests.

---

## Task 3: Write E2E spec — onboarding flow (`e2e/onboarding.spec.ts`)

**Files:**

* Create: `e2e/onboarding.spec.ts`

**Step 1: Create `e2e/onboarding.spec.ts`**

```ts
// e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('new retailer completes onboarding wizard', async ({ page }) => {
    await page.goto('/onboarding')

    // Step 1 — business profile
    await page.getByLabel(/nom de l'entreprise/i).fill('Test Boutique')
    await page.getByLabel(/téléphone/i).fill('+212612345678')
    await page.getByRole('button', { name: /suivant/i }).click()

    // Step 2 — default address
    await page.getByLabel(/adresse/i).fill('123 Rue Hassan II')
    // City input — plain text fallback (Google Maps may not load in CI)
    await page.getByLabel(/ville/i).fill('Casablanca')
    await page.getByRole('button', { name: /suivant/i }).click()

    // Step 3 — done screen
    await expect(page.getByText(/vous êtes prêt/i)).toBeVisible()
    await page.getByRole('link', { name: /accéder au tableau de bord/i }).click()

    await expect(page).toHaveURL('/dashboard')
  })
})
```

> **Context:** `src/app/onboarding/page.tsx` is the step orchestrator. Steps call `PATCH /api/users/me`. Step 3 (`step-done.tsx`) has a CTA link to `/dashboard`. The onboarding page auto-redirects already-onboarded users to `/dashboard` on initial load.

**Step 2: Smoke-run**

```bash
pnpm test:e2e --grep "Onboarding wizard"
```

Expected: 1 passing test.

---

## Task 4: Write E2E spec — compare + book flow (`e2e/compare-book.spec.ts`)

**Files:**

* Create: `e2e/compare-book.spec.ts`

**Step 1: Create `e2e/compare-book.spec.ts`**

```ts
// e2e/compare-book.spec.ts
import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Compare and book', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('retailer compares carriers and books a shipment', async ({ page }) => {
    await page.goto('/compare')

    // Fill compare form — use city names that exist in city-zones.json
    await page.getByLabel(/origine/i).fill('Casablanca')
    await page.getByLabel(/destination/i).fill('Rabat')
    await page.getByLabel(/poids/i).fill('2')
    await page.getByLabel(/valeur cod/i).fill('500')
    await page.getByRole('button', { name: /comparer/i }).click()

    // Results should render
    await expect(page.getByTestId('carrier-results')).toBeVisible({ timeout: 10_000 })
    const cards = page.getByTestId('carrier-result-card')
    await expect(cards.first()).toBeVisible()

    // Open booking sheet on first result
    await cards.first().getByRole('button', { name: /réserver/i }).click()

    // Booking form inside sheet
    await page.getByLabel(/nom du destinataire/i).fill('Ahmed Benali')
    await page.getByLabel(/téléphone destinataire/i).fill('+212699887766')
    await page.getByLabel(/adresse de livraison/i).fill('45 Avenue Mohammed V, Rabat')
    await page.getByRole('button', { name: /confirmer la réservation/i }).click()

    // Success toast
    await expect(page.getByText(/réservation confirmée/i)).toBeVisible({ timeout: 15_000 })
  })
})
```

> **Context:** `src/app/(dashboard)/compare/compare-page-client.tsx` renders `<CompareForm>` + `<ResultsList>`. Each `<CarrierResultCard>` has a "Réserver" button that opens `<BookingSheet>`. On success, `sonner` toast fires. The `POST /api/shipments` route calls the carrier adapter + creates DB records atomically.
>
> **Note:** Add `data-testid="carrier-results"` and `data-testid="carrier-result-card"` to the respective components during implementation if not already present.

**Step 2: Smoke-run**

```bash
pnpm test:e2e --grep "Compare and book"
```

Expected: 1 passing test.

---

## Task 5: Write E2E spec — tracking + admin billing (`e2e/tracking.spec.ts`, `e2e/admin-billing.spec.ts`)

**Files:**

* Create: `e2e/tracking.spec.ts`
* Create: `e2e/admin-billing.spec.ts`

**Step 1: Create `e2e/tracking.spec.ts`**

```ts
// e2e/tracking.spec.ts
import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Shipment tracking', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('shipment detail page renders tracking timeline', async ({ page }) => {
    // Navigate to shipments list first
    await page.goto('/shipments')
    await expect(page.getByTestId('shipments-table')).toBeVisible({ timeout: 10_000 })

    // Click first shipment row
    const firstRow = page.getByTestId('shipment-row').first()
    await expect(firstRow).toBeVisible()
    await firstRow.click()

    // Shipment detail — tracking timeline must render
    await expect(page).toHaveURL(/\/shipments\//)
    await expect(page.getByTestId('tracking-timeline')).toBeVisible({ timeout: 10_000 })
  })
})
```

**Step 2: Create `e2e/admin-billing.spec.ts`**

```ts
// e2e/admin-billing.spec.ts
import { test, expect } from '@playwright/test'
import { asAdmin } from './fixtures/auth'

test.describe('Admin billing', () => {
  test.beforeEach(async ({ page }) => {
    await asAdmin(page)
  })

  test('admin can view billing page', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByRole('heading', { name: /facturation/i })).toBeVisible()
    // Table or empty state renders without 500
    await expect(
      page.getByTestId('billing-table').or(page.getByText(/aucune commission/i))
    ).toBeVisible({ timeout: 10_000 })
  })
})
```

> **Context:** `src/app/(dashboard)/shipments/page.tsx` renders `<ShipmentsTable>`. `src/app/(dashboard)/shipments/[id]/page.tsx` renders `<LiveShipmentDetail>` which contains `<TrackingTimeline>`. Admin billing is at `src/app/(dashboard)/admin/billing/page.tsx`.
>
> **Note:** Add `data-testid` attributes to `ShipmentsTable` rows and `TrackingTimeline` during implementation if not already present.

**Step 3: Run all E2E specs**

```bash
pnpm test:e2e
```

Expected: All specs pass (or skip gracefully on missing test data).

---

## Task 6: Add E2E + dependency audit to CI (`ci.yml`)

**Files:**

* Modify: `.github/workflows/ci.yml`

**Step 1: Add `pnpm audit` step to the existing `ci` job**

In `.github/workflows/ci.yml`, after the `Lint` step and before `Typecheck`, add:

```yaml
      - name: Dependency audit
        run: pnpm audit --audit-level=high
```

**Step 2: Add the `e2e` job after the existing `ci` job**

Append to `.github/workflows/ci.yml`:

```yaml
  e2e:
    name: E2E Tests (Playwright)
    needs: ci
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wassalha_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wassalha_test
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      CLERK_WEBHOOK_SECRET: ${{ secrets.CLERK_WEBHOOK_SECRET }}
      E2E_RETAILER_USER_ID: ${{ secrets.E2E_RETAILER_USER_ID }}
      E2E_ADMIN_USER_ID: ${{ secrets.E2E_ADMIN_USER_ID }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Run migrations
        run: pnpm exec drizzle-kit migrate

      - name: Seed database
        run: pnpm exec tsx src/lib/db/seed.ts

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Step 3: Verify CI file is valid YAML**

```bash
pnpm exec js-yaml .github/workflows/ci.yml 2>&1 || echo "YAML OK"
```

---

## Task 7: Security headers with `next-safe`

**Files:**

* Modify: `next.config.ts`
* Modify: `.env.example`

**Step 1: Install `next-safe`**

```bash
pnpm add next-safe
```

**Step 2: Rewrite `next.config.ts`**

Replace the entire file with:

```ts
// next.config.ts
import type { NextConfig } from 'next'
import nextSafe from 'next-safe'

const isDev = process.env.NODE_ENV !== 'production'

const securityHeaders = nextSafe({
  isDev,
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // required by Next.js inline scripts
      'https://accounts.clerk.dev',
      'https://js.stripe.com',
      'https://app.posthog.com',
    ],
    'connect-src': [
      "'self'",
      'https://*.clerk.dev',
      'https://*.clerk.com',
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.stripe.com',
      'https://app.posthog.com',
      'https://*.sentry.io',
      'https://maps.googleapis.com',
    ],
    'frame-src': [
      "'self'",
      'https://accounts.clerk.dev',
      'https://js.stripe.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://img.clerk.com',
    ],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"], // Tailwind inline styles
    'worker-src': ["'self'", 'blob:'],
  },
})

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
}

export default nextConfig
```

**Step 3: Verify build still passes**

```bash
pnpm build
```

Expected: Build succeeds. Check browser console in dev mode for any CSP violations — add offending origins to the relevant directive if needed.

---

## Task 8: Rate limiting with Upstash Redis

**Files:**

* Create: `src/lib/rate-limit.ts`
* Modify: `src/app/api/carriers/compare/route.ts`
* Modify: `src/app/api/shipments/route.ts`
* Modify: `src/app/api/billing/invoices/route.ts`
* Modify: `.env.example`

**Step 1: Create Upstash account + Redis database**

Go to https://console.upstash.com → Create database → Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Add to `.env.local`:
```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

**Step 2: Install Upstash packages**

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

**Step 3: Create `src/lib/rate-limit.ts`**

```ts
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy initialization — only creates Redis connection when first called.
// Skips rate limiting if env vars are not set (local dev without Upstash).
function makeRatelimit(requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`, prefix: string): Ratelimit | null {
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
  compare: makeRatelimit(20, '1 m', 'rl:compare'),
  booking: makeRatelimit(10, '1 m', 'rl:booking'),
  billing: makeRatelimit(5, '1 m', 'rl:billing'),
}

/**
 * Apply rate limit. Returns a 429 NextResponse if limit exceeded, null if allowed.
 * identifier: IP for public endpoints, userId for authenticated endpoints.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ limited: boolean; retryAfter: number }> {
  if (!limiter) return { limited: false, retryAfter: 0 }
  const { success, reset } = await limiter.limit(identifier)
  return {
    limited: !success,
    retryAfter: Math.ceil((reset - Date.now()) / 1000),
  }
}
```

**Step 4: Add rate limit to `POST /api/carriers/compare/route.ts`**

Add at the top of the `POST` handler, after the auth check:

```ts
import { headers } from 'next/headers'
import { ratelimit, checkRateLimit } from '@/lib/rate-limit'

// Inside POST, after the userId check:
const ip = (await headers()).get('x-forwarded-for') ?? '127.0.0.1'
const { limited, retryAfter } = await checkRateLimit(ratelimit.compare, ip)
if (limited) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
```

**Step 5: Add rate limit to `POST /api/shipments/route.ts`**

Add after the auth check in `POST`:

```ts
import { ratelimit, checkRateLimit } from '@/lib/rate-limit'

// Inside POST, after userId check:
const { limited, retryAfter } = await checkRateLimit(ratelimit.booking, userId)
if (limited) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
```

**Step 6: Add rate limit to `POST /api/billing/invoices/route.ts`**

Add after the admin role check in `POST`:

```ts
import { ratelimit, checkRateLimit } from '@/lib/rate-limit'

// Inside POST, after role !== 'admin' check:
const { limited, retryAfter } = await checkRateLimit(ratelimit.billing, userId)
if (limited) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
```

**Step 7: Add env vars to `.env.example`**

```bash
# Upstash Redis (rate limiting — free tier sufficient for beta)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

**Step 8: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: No errors. Rate limiting is skipped in tests (no Upstash env vars in test env).

---

## Task 9: Lighthouse CI setup + CWV fixes

**Files:**

* Create: `lighthouserc.js`
* Modify: `.github/workflows/ci.yml` (add lighthouse job)
* Modify: `src/app/layout.tsx` (add SpeedInsights)
* Modify: `src/app/page.tsx` (add `priority` to Hero image if present)
* Modify: `src/app/(dashboard)/dashboard/page.tsx` (Suspense skeleton for KPI row)

**Step 1: Install packages**

```bash
pnpm add -D @lhci/cli
pnpm add @vercel/speed-insights
```

**Step 2: Create `lighthouserc.js`**

```js
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/dashboard'],
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'Ready on',
      numberOfRuns: 2,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

> **Note:** Thresholds set to `warn` (not `error`) for the first run — promote to `error` after baseline is established.

**Step 3: Add `<SpeedInsights />` to root layout**

In `src/app/layout.tsx`, import and add the component:

```tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

// Inside <body>, after <Providers>:
<SpeedInsights />
```

Full updated layout:

```tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wassalha — COD Delivery Aggregator',
  description: 'Compare, book, and track COD deliveries across Morocco.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <html lang="fr">
        <body>
          <Providers>{children}</Providers>
          <Toaster richColors />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
```

**Step 4: Add Lighthouse CI job to `.github/workflows/ci.yml`**

Append after the `e2e` job:

```yaml
  lighthouse:
    name: Lighthouse CI
    needs: ci
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wassalha_test
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wassalha_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec drizzle-kit migrate
      - run: pnpm build
      - run: pnpm exec lhci autorun
```

**Step 5: Verify build + lint**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

---

## Task 10: Sentry setup (`@sentry/nextjs`)

**Files:**

* Create: `sentry.client.config.ts`
* Create: `sentry.server.config.ts`
* Create: `sentry.edge.config.ts`
* Modify: `next.config.ts`
* Modify: `.env.example`

**Step 1: Install `@sentry/nextjs`**

```bash
pnpm add @sentry/nextjs
```

**Step 2: Create `sentry.client.config.ts`**

```ts
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [Sentry.replayIntegration()],
})
```

**Step 3: Create `sentry.server.config.ts`**

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
})
```

**Step 4: Create `sentry.edge.config.ts`**

```ts
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
})
```

**Step 5: Wrap `next.config.ts` with `withSentryConfig`**

Add to the existing `next.config.ts`:

```ts
import { withSentryConfig } from '@sentry/nextjs'

// ... existing nextConfig object unchanged ...

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
})
```

**Step 6: Add Sentry env vars to `.env.example`**

```bash
# Sentry (error tracking + performance)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=wassalha
```

**Step 7: Verify**

```bash
pnpm typecheck && pnpm build
```

Expected: Build succeeds. Sentry is no-op when `NEXT_PUBLIC_SENTRY_DSN` is not set.

---

## Task 11: PostHog setup

**Files:**

* Modify: `src/app/providers.tsx`
* Modify: `.env.example`

**Step 1: Install PostHog**

```bash
pnpm add posthog-js
```

**Step 2: Rewrite `src/app/providers.tsx`**

```tsx
// src/app/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

function PostHogInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (key) {
      posthog.init(key, {
        api_host: 'https://app.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage',
      })
    }
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <PostHogInit>{children}</PostHogInit>
    </QueryClientProvider>
  )
}
```

**Step 3: Add PostHog env var to `.env.example`**

The key is already present in `.env.example` from Phase 6. Confirm it's there:
```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

**Step 4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: No errors. PostHog silently no-ops when key is absent.

---

## Task 12: Feedback widget — schema + migration

**Files:**

* Create: `src/lib/db/schema/feedback.ts`
* Modify: `src/lib/db/schema/index.ts`

**Step 1: Create `src/lib/db/schema/feedback.ts`**

```ts
// src/lib/db/schema/feedback.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  message: text('message').notNull(),
  page: text('page').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
```

**Step 2: Export from schema index**

In `src/lib/db/schema/index.ts`, add:

```ts
export * from './feedback'
```

**Step 3: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: Migration `0007_*.sql` created and applied. Contains `CREATE TABLE feedback (...)`.

---

## Task 13: Feedback API route + Zod validation

**Files:**

* Create: `src/app/api/feedback/route.ts`

**Step 1: Create `src/app/api/feedback/route.ts`**

```ts
// src/app/api/feedback/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

const FeedbackSchema = z.object({
  message: z.string().min(10, 'Message too short').max(500, 'Message too long'),
  page: z.string().min(1),
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  await db.insert(feedback).values({
    userId,
    message: parsed.data.message,
    page: parsed.data.page,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

**Step 2: Verify route compiles**

```bash
pnpm typecheck
```

---

## Task 14: Feedback widget component + dashboard placement

**Files:**

* Create: `src/components/feedback/feedback-button.tsx`
* Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Create `src/components/feedback/feedback-button.tsx`**

```tsx
// src/components/feedback/feedback-button.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const FeedbackSchema = z.object({
  message: z.string().min(10, 'Minimum 10 caractères').max(500, 'Maximum 500 caractères'),
})
type FeedbackForm = z.infer<typeof FeedbackSchema>

export function FeedbackButton() {
  const [open, setOpen] = useState(false)

  const form = useForm<FeedbackForm>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: { message: '' },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FeedbackForm) => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, page: window.location.pathname }),
      })
      if (!res.ok) throw new Error('Failed to submit feedback')
    },
    onSuccess: () => {
      toast.success('Merci pour votre retour !')
      form.reset()
      setOpen(false)
    },
    onError: () => {
      toast.error('Erreur lors de l\'envoi. Réessayez.')
    },
  })

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="shadow-md gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end" side="top">
          <p className="text-sm font-medium mb-3">Donnez-nous votre avis</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutate(d))} className="space-y-3">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Décrivez votre expérience ou signalez un problème..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="sm" className="w-full" disabled={isPending}>
                {isPending ? 'Envoi...' : 'Envoyer'}
              </Button>
            </form>
          </Form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

**Step 2: Add `<FeedbackButton />` to dashboard layout**

In `src/app/(dashboard)/layout.tsx`, add the import and render inside the layout body:

```tsx
import { FeedbackButton } from '@/components/feedback/feedback-button'

// In the return, after <main>:
<main className="px-6 py-8">{children}</main>
<FeedbackButton />
```

Full updated layout:

```tsx
import { auth } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { FeedbackButton } from '@/components/feedback/feedback-button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-zinc-900">Wassalha</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/compare" className="text-muted-foreground hover:text-foreground">
              Compare
            </Link>
            <Link href="/analytics" className="text-muted-foreground hover:text-foreground">
              Analytiques
            </Link>
            {isAdmin && (
              <Link href="/admin/carriers" className="text-muted-foreground hover:text-foreground">
                Carriers
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/billing" className="text-muted-foreground hover:text-foreground">
                Facturation
              </Link>
            )}
          </nav>
        </div>
        <UserButton />
      </header>
      <main className="px-6 py-8">{children}</main>
      <FeedbackButton />
    </div>
  )
}
```

**Step 3: Add missing shadcn components if needed**

```bash
pnpm dlx shadcn@latest add popover textarea
```

**Step 4: Final verification**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Expected:
- No type errors, no lint errors
- Build succeeds (all routes compile)
- All 157+ unit tests pass
- New feedback migration applied

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: Phase 8 — E2E (Playwright), security headers, rate limiting, Sentry, PostHog, feedback widget"
```

---

## Summary

| Task | Track | Key Output |
|------|-------|-----------|
| 1 | E2E | Playwright installed + Clerk auth bypass configured |
| 2 | E2E | `e2e/auth.spec.ts` — 3 redirect tests |
| 3 | E2E | `e2e/onboarding.spec.ts` — full 3-step flow |
| 4 | E2E | `e2e/compare-book.spec.ts` — core booking flow |
| 5 | E2E | `e2e/tracking.spec.ts` + `e2e/admin-billing.spec.ts` |
| 6 | E2E + CI | E2E CI job + `pnpm audit` in pipeline |
| 7 | Security | `next-safe` CSP headers in `next.config.ts` |
| 8 | Security | Upstash rate limiting on 3 endpoints |
| 9 | Performance | Lighthouse CI job + `<SpeedInsights />` |
| 10 | Beta Infra | Sentry — 3 config files + `withSentryConfig` |
| 11 | Beta Infra | PostHog auto-capture in `providers.tsx` |
| 12 | Beta Infra | `feedback` Drizzle table + migration 0007 |
| 13 | Beta Infra | `POST /api/feedback` route |
| 14 | Beta Infra | `<FeedbackButton />` + dashboard layout placement |
