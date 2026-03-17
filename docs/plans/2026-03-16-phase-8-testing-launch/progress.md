# Execution Progress

**Plan:** `docs/plans/2026-03-16-phase-8-testing-launch/plan.md`
**Last updated:** 2026-03-16

## Status

| Task | Title | Status |
|------|-------|--------|
| 1 | Install Playwright + configure with Clerk auth bypass | ✅ completed |
| 2 | Write E2E spec — auth redirects | ✅ completed |
| 3 | Write E2E spec — onboarding flow | ✅ completed |
| 4 | Write E2E spec — compare + book flow | ✅ completed |
| 5 | Write E2E spec — tracking + admin billing | ✅ completed |
| 6 | Add E2E + dependency audit to CI | ✅ completed |
| 7 | Security headers with next-safe | ✅ completed |
| 8 | Rate limiting with Upstash Redis | ✅ completed |
| 9 | Lighthouse CI setup + CWV fixes | ✅ completed |
| 10 | Sentry setup | ✅ completed |
| 11 | PostHog setup | ✅ completed |
| 12 | Feedback widget — schema + migration | ✅ completed |
| 13 | Feedback API route + Zod validation | ⏳ pending |
| 14 | Feedback widget component + dashboard placement | ⏳ pending |

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-03-16
- ✅ Task 1: Installed `@playwright/test@1.58.2` + `@clerk/testing@2.0.4` (dev). Installed Chromium browser. Created `playwright.config.ts` (globalSetup, chromium only, webServer dev). Created `e2e/global-setup.ts` (clerkSetup). Created `e2e/fixtures/auth.ts` with `asRetailer()` + `asAdmin()` using `clerk.signIn` with `email_code` strategy (corrected from `userId` — v2 API uses emailAddress). Added `test:e2e` script to `package.json`. Updated `.env.example` with `E2E_RETAILER_EMAIL` + `E2E_ADMIN_EMAIL` (test users need `+clerk_test` email suffix).
- ✅ Task 2: Created `e2e/auth.spec.ts` — 3 unauthenticated redirect tests (`/dashboard`, `/compare`, `/admin/carriers` all redirect to `/sign-in`).
- ✅ Task 3: Created `e2e/onboarding.spec.ts` — full 3-step wizard flow (business profile → address → done → /dashboard redirect).
- Verification: typecheck ✅ lint ✅

### Batch 2 (Tasks 4–6) — 2026-03-16
- ✅ Task 4: Created `e2e/compare-book.spec.ts`. Added `data-testid="carrier-results"` to `results-list.tsx` wrapper div and `data-testid="carrier-result-card"` to `carrier-result-card.tsx` Card.
- ✅ Task 5: Created `e2e/tracking.spec.ts` (uses `data-testid="shipments-table"`, `data-testid="shipment-row"`, `data-testid="tracking-timeline"`). Created `e2e/admin-billing.spec.ts`. Added `data-testid` to `ShipmentsTable` + `TrackingTimeline` components.
- ✅ Task 6: Added `pnpm audit --audit-level=high` step to existing `ci` job (before Lint). Appended full `e2e` job to `ci.yml` (needs: ci, postgres service, E2E_RETAILER_EMAIL + E2E_ADMIN_EMAIL secrets, Playwright report artifact upload). Updated CI env vars from user IDs to email addresses.
- Verification: typecheck ✅ lint ✅ build ✅ (34 routes)

### Batch 3 (Tasks 7–9) — 2026-03-16
- ✅ Task 7: Installed `next-safe@3.5.0`. Rewrote `next.config.ts` with CSP headers covering Clerk, Supabase, Stripe, PostHog, Sentry, Google Maps. Used `require()` with inline type assertion (next-safe has CJS module.exports; `import default` fails TS). Build verified.
- ✅ Task 8: Installed `@upstash/ratelimit@2.0.8` + `@upstash/redis@1.37.0`. Created `src/lib/rate-limit.ts` with lazy init (no-op when Upstash env vars absent). Added rate limit checks to `POST /api/carriers/compare` (20/min per IP), `POST /api/shipments` (10/min per userId), `POST /api/billing/invoices` (5/min per userId).
- ✅ Task 9: Installed `@lhci/cli@0.15.1` + `@vercel/speed-insights@2.0.0`. Created `lighthouserc.js` (warn thresholds: perf≥0.8, LCP<2.5s, CLS<0.1). Added `<SpeedInsights />` to `src/app/layout.tsx`. Added Lighthouse CI job to `ci.yml`. Also fixed Vitest picking up e2e specs — added `exclude: ["**/e2e/**"]` to `vitest.config.ts`.
- Verification: typecheck ✅ lint ✅ build ✅ tests 157/157 ✅

### Batch 4 (Tasks 10–12) — 2026-03-17
- ✅ Task 10: Installed `@sentry/nextjs`. Created `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`. Wrapped `next.config.ts` with `withSentryConfig`. Fixed: `hideSourceMaps` renamed to `sourcemaps.deleteSourcemapsAfterUpload` in current Sentry version. Added `src/app/global-error.tsx` (Sentry React render error capture — suppresses Sentry build warning). Build ✅ with "Compiled successfully".
- ✅ Task 11: Installed `posthog-js`. Rewrote `src/app/providers.tsx` with `PostHogInit` wrapper + `PostHogProvider`. Lazy init via `useEffect` — no-op when `NEXT_PUBLIC_POSTHOG_KEY` absent.
- ✅ Task 12: Created `src/lib/db/schema/feedback.ts` (uuid PK, userId, message, page, createdAt). Exported from `schema/index.ts`. Generated + applied migration `0007_fair_captain_britain.sql`.
- Verification: typecheck ✅ lint ✅ tests 157/157 ✅

## Resume Instructions
To continue: run `/executing-plans` and reference this progress file.
Next batch starts at Task 13.
