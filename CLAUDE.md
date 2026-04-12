## Project Overview
Wassalha — B2B COD Delivery Aggregator for Morocco.
Next.js 15 full-stack app (App Router). API: Next.js API Routes (TypeScript). Frontend: React 19 + shadcn/ui.
Domain: Carrier comparison, one-click booking, real-time tracking, commission billing, push notifications.
Focus: Type-safety, performance, bilingual support (French/Darija), RBAC security, mobile-first responsive.

## Rules
- Concise interactions. Priority: clarity over grammar.
- Architecture: Feature-based modules. No business logic in API route handlers directly — use service layer.
- ORM: Drizzle ORM only. Raw SQL prohibited unless for complex aggregations.
- Migrations: Drizzle Kit migrations for all schema changes. No `db push` in production.
- Commit messages: Follow Conventional Commits.
- **Formatting**: Prettier + ESLint enforced on all `.ts` and `.tsx` files. No `any` types.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, React 19.
- **API Layer**: Next.js API Routes (TypeScript). Hono deferred — not in use.
- **Database**: PostgreSQL (Neon cloud) + Drizzle ORM.
- **Auth**: Clerk (hosted UI + publicMetadata role + JWT template). NextAuth dropped.
- **Real-time**: Supabase Realtime (Phase 5 — implemented). postgres_changes for tracking_events INSERT + polling fallback for shipments UPDATE.
- **Maps**: Google Maps API (address autocomplete, Morocco-restricted). Mapbox dropped — not needed.
- **Payments**: Stripe TEST account in production — real Stripe prod unavailable for Morocco merchants. Using test mode keys (`sk_test_...`) in Vercel env. Invoice generation + webhook work end-to-end but process no real money. Do NOT switch to live keys until a Morocco-compatible processor is confirmed (PayGate Africa under review). Remaining: carrier API keys for Amana/CTM/Marocolis/Sendex (pending signed contracts).
- **Email**: Resend (Phase 4 — booking confirmation). Lazy-initialized, skipped if key missing.
- **Notifications**: WhatsApp Business API (wired in `bookings.ts`, skips if credentials missing. ⏭ Meta account restricted — appeal submitted 2026-03-18). Web Push (W9 ✅ — VAPID, `push_subscriptions` table, bell toggle in dashboard, triggered from cron poller on status change).
- **Deployment**: Vercel (app — https://wassalha.vercel.app). Connected to `main` branch.
- **CI/CD**: GitHub Actions — lint + tsc + vitest + build on every push.
- **Monitoring**: Sentry (`@sentry/nextjs` — Phase 8 ✅) + PostHog (`posthog-js` — Phase 8 ✅). Both live in production.
- **Rate limiting**: Upstash Redis (`@upstash/ratelimit` — Phase 8 ✅). 20 req/min sliding window on `/api/carriers/compare`.
- **Performance**: Vercel Speed Insights (`@vercel/speed-insights`). Root layout stripped to minimal HTML shell — landing page pre-renders as fully static.
- **Build**: pnpm v9+ (global package manager).

## Development Commands
- `pnpm dev` — Start full-stack dev server (Next.js).
- `pnpm build` — Production build.
- `pnpm lint` — Lint all TypeScript/React files.
- `pnpm db:generate` — Generate Drizzle migration files.
- `pnpm db:migrate` — Run pending migrations.
- `pnpm db:studio` — Open Drizzle Studio (DB GUI).
- `pnpm test` — Run Vitest unit tests.
- `pnpm test:e2e` — Run Playwright end-to-end tests.

## Environment Requirements
- **Node.js**: v20+ (LTS). Ensure `node -v` returns 20+.
- **pnpm**: v9+. Install via `npm install -g pnpm`.
- **Git Config**: Run `git config --global core.autocrlf input` for cross-platform line endings.
- **Database**: PostgreSQL via Supabase (cloud) or local Docker container.

---

## Implementation Status

### ✅ Phase 1 — Foundation (Week 1: March 17–21, 2026)

Project scaffolding, DB schema, auth, CI/CD pipeline. **Complete.**

### ✅ Phase 2 — Address + Carrier Data (Week 2)

Address autocomplete (Google Places), carrier DB seeding (5 carriers), admin CRUD panel, Zod validation, service layer, TanStack Query hooks. **Complete. 71 tests passing.**

### ✅ Phase 3 — Comparison Engine (Week 3)

Ranking algorithm (cost/speed/reliability with mode weights), `POST /api/carriers/compare`, city-zone static mapping, comparison service, filter/sort UI, TanStack Query mutation hook. **Complete. 78 tests passing.**

### ✅ Phase 4 — Booking + Commission (Week 4)

One-click booking (BookingSheet → carrier adapter → atomic DB transaction), shipment records, dual-rate commission engine (10% shipping + 1.5% COD), Resend confirmation email + WhatsApp recipient notification. **Complete. 99 tests passing.**


### ✅ Phase 5 — Real-time Tracking (Week 5)

Carrier tracking integrations (Aramex + 4 stubs), unified tracking model, live stepper + badge, cron poller (hourly), Supabase Realtime + polling fallback. **Complete. 107 tests passing. Test plan Parts 1–3 done. Part 4 (edge cases) in progress.**

### ✅ Phase 6 — Dashboard + Analytics (Week 6)

Role-aware KPI dashboard (6 retailer cards + 3 admin pipeline cards), Recharts analytics (tabbed: volume/spend/carrier), CSV exports, Stripe commission billing (invoice generation + webhook). **Complete. 146 tests passing. Smoke tests S1–S16 done (S10, S11 deferred — no test data / no Stripe test key). 3 bugs found and fixed during smoke testing.**

**Smoke test bugs fixed:**
- `analytics.ts` — raw SQL `c.` alias caused 500 on `/dashboard` (fixed: use Drizzle column refs)
- `kpi-row.tsx` — showed `0` instead of `—` for new retailers with no shipments (fixed: null when `totalShipments === 0`)
- `GET /api/billing/invoices` — `StripeAuthenticationError` not caught → 500 + TanStack Query retry storm (fixed: catch Stripe auth errors + `retry: false`)

### ✅ Phase 7 — Landing Page + Onboarding (Week 7)

Marketing landing page (Hero in Darija + French, FAQ accordion, CTA), 3-step onboarding wizard (`/onboarding`), user profile API (`GET/PATCH /api/users/me`), compare form pre-fill from saved city, WhatsApp already wired. **Complete. 157 tests passing. All S1–S10 smoke tests passed.**

**Smoke test bugs fixed:**
- Phone validation rejected spaces — fixed with `.transform()` strip before regex
- `GET /api/users/me` 404 for new users — fixed: lazy upsert via `currentUser()` when Clerk webhook doesn't fire to localhost
- `PATCH /api/users/me` 500 (json(undefined)) — fixed: null-check returns 404
- Onboarding redirect too early (after step 1) — fixed: only redirect at `step === 1` on initial load

### ✅ Phase 8 — Testing + Launch (Week 8)

E2E Playwright (5 flow specs), Lighthouse CI (perf ≥ 80), next-safe CSP headers, Upstash rate limiting (compare/shipments/billing), Sentry error monitoring, PostHog analytics, in-app feedback widget (schema + API + component). **Complete. 164 tests passing.**

**Post-Phase-8 performance fix (2026-03-18):** Stripped root layout to minimal HTML shell; created `src/app/(app)/layout.tsx` wrapping only app routes. Landing page now fully static (○) with no cross-origin Clerk JS.

### ✅ W9 — Notifications + Audit + Web Push (2026-03-18)

`notifications` table (email/whatsapp/web_push log per shipment), `audit_logs` table (admin action trail: carrier CRUD, invoice generation, role changes), `push_subscriptions` table, Web Push service (VAPID), push API routes (`/api/push/subscribe`, `/api/push/vapid-public-key`), service worker (`public/sw.js`), `useWebPush` hook, `PushToggle` bell component in dashboard header, cron poller triggers push on status change. **Complete. 178 tests passing. All smoke tests S1–S10 passed (2026-03-20).**

**Smoke test fixes (2026-03-20):** (1) `DATABASE_URL` switched to Supabase transaction-mode pooler (port 6543) — session mode exhausted under concurrent Vercel lambdas. (2) VAPID keys on Vercel had `=` padding — corrected via `vercel env add`. Added `toBase64url()` normalization in `web-push.ts`.

### ✅ W10 — Aramex Real SOAP Integration (2026-04-12)

Replaced the mock Aramex adapter with a live SOAP adapter (`fast-xml-parser`). Hybrid pricing in the comparison engine — Aramex rates fetched live (3s timeout + graceful exclusion), all other carriers use static DB pricing. New `GET /api/shipments/[id]/label` route for on-demand Aramex shipping label download. Mock routes (`/api/mock-aramex/`) deleted. **Complete. Tests passing.**

### ✅ W11 — Bulk Compare + Import (2026-04-12)

"Bulk Import" tab on the compare page — upload CSV or Excel (up to 50 rows), run a single batch comparison via `POST /api/carriers/compare/bulk` (sequential per row, partial failures inline, 3 req/min rate limit), expandable results table showing all carriers per row, per-row "Book" button + checkbox bulk select + confirmation dialog, CSV export of results. SheetJS (`xlsx`) dynamically imported — zero bundle impact. **Complete. 196 tests passing (18 new). Manual test plan at `docs/plans/2026-04-12-bulk-compare/manual-test.md`.**

---

### 🎯 Feature Status

| Feature | API | Frontend | Notes |
|---------|-----|----------|-------|
| Project Scaffolding | ✅ | ✅ | Next.js 15 + Tailwind 4 + shadcn/ui |
| Authentication (Clerk/NextAuth) | ✅ | ✅ | Clerk hosted UI + publicMetadata role + JWT template |
| DB Schema + Migrations | ✅ | — | users + carriers + carrier_zones + carrier_pricing + shipments + commissions |
| CI/CD Pipeline | ✅ | ✅ | GitHub Actions — lint + tsc + vitest + build |
| Address Autocomplete | ✅ | ✅ | Google Places API (Morocco-restricted) + plain-text fallback |
| Carrier Database + Admin CRUD | ✅ | ✅ | 5 carriers seeded, full admin panel with RBAC |
| Carrier Comparison Engine | ✅ | ✅ | Ranking: cost, speed, reliability — 99 tests |
| One-click Booking | ✅ | ✅ | CarrierAdapter → atomic TX → Resend email + WhatsApp |
| Commission Engine | ✅ | ✅ | Dual-rate: 10% shipping + 1.5% COD |
| Real-time GPS Tracking | ✅ | ✅ | Supabase Realtime + 10s polling fallback |
| Retailer Dashboard | ✅ | ✅ | KPI row (6 cards) + recent shipments |
| Analytics + Charts | ✅ | ✅ | Recharts tabbed panel, DateRangePicker, CSV export |
| Commission Billing | ✅ | ✅ | Stripe invoices — admin generates per-retailer invoices, webhook marks paid |
| Marketing Landing Page | ✅ | ✅ | Hero (Darija + French), value props, FAQ accordion, CTA footer |
| Onboarding Wizard | ✅ | ✅ | 3-step: business profile → default address → done. Clerk redirect. |
| WhatsApp Notifications | ✅ | — | Wired in bookings.ts. Meta Graph API, skips if no credentials. |
| Web Push Notifications | ✅ | ✅ | W9 — VAPID, push_subscriptions, bell toggle, cron trigger |
| Notifications Log | ✅ | — | W9 — notifications table, logs email/whatsapp/web_push per shipment |
| Audit Trail | ✅ | ✅ | W9 — audit_logs table + /admin/audit-logs RSC page |
| Aramex Live SOAP | ✅ | ✅ | W10 — real SOAP adapter, hybrid pricing, label download |
| Bulk Compare + Import | ✅ | ✅ | W11 — CSV/Excel upload, batch comparison, bulk booking, CSV export |
| Beta Launch (20 retailers) | ✅ | ✅ | Feedback loop active |

### 📊 Codebase Metrics

**Current (W11 complete — 2026-04-12):**
- Drizzle schema: 11 tables live — users, carriers, carrier_zones, carrier_pricing, shipments, commissions, tracking_events, feedback, notifications, audit_logs, push_subscriptions
- Migrations: 9 applied (0000–0008)
- API routes: 27 route files live (+compare/bulk, +shipments/[id]/label)
- React components: 46 built (+bulk-import-panel, +dialog, +checkbox)
- Tests: 196 passing (18 new bulk compare validation tests; 1 pre-existing rate-limit flaky)
- Services: 9 (carriers, comparison, bookings, commission, tracking, analytics, billing, users, audit)
- Hooks: 12 TanStack Query/browser hooks (+use-bulk-compare)
- Notification services: 3 (email, whatsapp, web-push)

---

### 📦 Project Structure (actual — W11 complete)

```
wassalha/
├── src/
│   ├── app/                           # Next.js 15 App Router
│   │   ├── layout.tsx                 # Root layout — minimal HTML shell only (no providers)
│   │   │                              # Landing page / pre-renders fully static (no Clerk JS)
│   │   ├── page.tsx                   # Marketing landing page ✅ (static, no auth dependency)
│   │   ├── global-error.tsx           # Sentry global error boundary ✅
│   │   ├── globals.css                # Tailwind 4 global styles
│   │   ├── providers.tsx              # TanStack Query provider (used by (app)/layout.tsx)
│   │   ├── (app)/                     # Route group: all app routes (auth + dashboard + onboarding)
│   │   │   ├── layout.tsx             # App shell — ClerkProvider + Providers + Toaster + SpeedInsights
│   │   │   ├── (auth)/                # Clerk hosted auth pages
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   │   ├── (dashboard)/           # Protected routes (Clerk middleware)
│   │   │   │   ├── layout.tsx         # Dashboard shell (sidebar nav)
│   │   │   │   ├── dashboard/page.tsx # Dashboard home (KPI cards + recent shipments)
│   │   │   │   ├── compare/           # Carrier comparison ✅
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── compare-page-client.tsx  # Single/Bulk Import tabs
│   │   │   │   ├── analytics/         # Analytics charts ✅
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── shipments/         # Shipments ✅
│   │   │   │   │   ├── page.tsx       # Shipments list
│   │   │   │   │   └── [id]/page.tsx  # Shipment detail + live tracking
│   │   │   │   └── admin/
│   │   │   │       ├── carriers/      # Carrier admin CRUD (admin only) ✅
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── new/page.tsx
│   │   │   │       │   └── [id]/page.tsx
│   │   │   │       ├── billing/       # Commission billing (admin only) ✅
│   │   │   │       │   └── page.tsx
│   │   │   │       └── audit-logs/    # Audit trail (admin only) ✅ W9
│   │   │   │           └── page.tsx
│   │   │   └── onboarding/            # 3-step onboarding wizard ✅
│   │   │       ├── page.tsx           # Step orchestrator (already-onboarded redirect)
│   │   │       ├── step-business.tsx  # Step 1: business name + phone
│   │   │       ├── step-address.tsx   # Step 2: default sender address + city
│   │   │       └── step-done.tsx      # Step 3: success + CTA → /compare
│   │   └── api/                       # Next.js API Routes
│   │       ├── carriers/              # Carrier CRUD + comparison ✅
│   │       │   ├── route.ts           # GET list, POST create
│   │       │   ├── [id]/route.ts      # GET, PUT, DELETE
│   │       │   ├── [id]/zones/route.ts
│   │       │   ├── [id]/zones/[zoneId]/route.ts
│   │       │   ├── [id]/zones/[zoneId]/pricing/route.ts
│   │       │   ├── [id]/zones/[zoneId]/pricing/[pricingId]/route.ts
│   │       │   ├── compare/route.ts   # POST comparison engine (rate limited)
│   │       │   └── compare/bulk/route.ts  # POST bulk comparison — up to 50 rows ✅ W11
│   │       ├── shipments/             # Booking ✅
│   │       │   ├── route.ts           # POST book, GET list
│   │       │   ├── [id]/route.ts      # GET single
│   │       │   └── export/route.ts    # GET CSV download
│   │       ├── analytics/             # Analytics ✅
│   │       │   ├── summary/route.ts   # GET KPI cards
│   │       │   └── charts/route.ts    # GET time-series + carrier breakdown
│   │       ├── commissions/
│   │       │   └── export/route.ts    # GET CSV download (admin) ✅
│   │       ├── billing/
│   │       │   └── invoices/route.ts  # POST create Stripe invoice, GET list (admin) ✅
│   │       ├── push/                  # Web Push API ✅ W9
│   │       │   ├── vapid-public-key/route.ts  # GET VAPID public key (auth required)
│   │       │   └── subscribe/route.ts         # POST upsert + DELETE remove subscription
│   │       ├── cron/tracking/route.ts # Tracking poller (daily on Vercel Hobby) ✅
│   │       │   # Mock Aramex routes removed (W10) — real SOAP adapter uses Aramex staging endpoints
│   │       ├── users/me/route.ts      # GET + PATCH user profile ✅
│   │       ├── feedback/route.ts      # POST submit feedback (auth + Zod) ✅
│   │       └── webhooks/
│   │           ├── clerk/route.ts     # Clerk user sync ✅
│   │           └── stripe/route.ts    # Stripe invoice.paid → mark commissions paid ✅
│   ├── components/
│   │   ├── ui/                        # shadcn/ui primitives (19 components) ✅
│   │   │   # accordion, badge, button, calendar, card, checkbox, dialog, form, input, label,
│   │   │   # popover, separator, sheet, sonner, table, tabs, textarea, toggle, toggle-group
│   │   ├── carriers/                  # Carrier admin UI ✅
│   │   │   ├── carrier-form.tsx
│   │   │   ├── carrier-table.tsx
│   │   │   └── zone-accordion.tsx
│   │   ├── compare/                   # Comparison UI ✅
│   │   │   ├── compare-form.tsx
│   │   │   ├── results-list.tsx
│   │   │   ├── carrier-result-card.tsx
│   │   │   ├── city-autocomplete.tsx
│   │   │   ├── mode-toggle.tsx
│   │   │   └── bulk-import-panel.tsx  # Bulk CSV/Excel import + results table ✅ W11
│   │   ├── booking/                   # Booking sheet ✅
│   │   │   ├── booking-sheet.tsx
│   │   │   └── booking-form.tsx
│   │   ├── forms/                     # Shared form components ✅
│   │   │   └── address-autocomplete.tsx
│   │   ├── shipments/                 # Shipments table ✅
│   │   │   ├── shipments-table.tsx
│   │   │   └── status-badge.tsx
│   │   ├── tracking/                  # Tracking UI ✅
│   │   │   ├── tracking-timeline.tsx
│   │   │   └── live-shipment-detail.tsx
│   │   ├── dashboard/                 # KPI dashboard ✅
│   │   │   ├── stat-card.tsx
│   │   │   └── kpi-row.tsx
│   │   ├── analytics/                 # Analytics charts ✅
│   │   │   ├── chart-panel.tsx
│   │   │   ├── date-range-picker.tsx
│   │   │   └── charts/
│   │   │       ├── volume-chart.tsx
│   │   │       ├── spend-chart.tsx
│   │   │       └── carrier-chart.tsx
│   │   ├── billing/                   # Billing UI (admin) ✅
│   │   │   ├── retailer-billing-table.tsx
│   │   │   └── invoice-history-table.tsx
│   │   ├── notifications/             # Notification UI ✅ W9
│   │   │   └── push-toggle.tsx        # Bell toggle (subscribe/unsubscribe web push)
│   │   └── feedback/                  # Feedback widget ✅
│   │       └── feedback-button.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema/                # users, carriers, carrier_zones, carrier_pricing,
│   │   │   │                          # shipments, commissions, tracking_events, feedback,
│   │   │   │                          # notifications, audit_logs, push_subscriptions ✅ W9
│   │   │   ├── migrations/            # 0000–0008 applied ✅
│   │   │   ├── seed.ts                # 5 carriers seeded ✅
│   │   │   └── index.ts               # Drizzle + pg Pool client
│   │   ├── carriers/
│   │   │   ├── adapters/              # amana, aramex, ctm, marocolis, sendex ✅
│   │   │   ├── types.ts               # CarrierAdapter interface + CarrierApiError ✅
│   │   │   ├── city-zones.ts          # City → zone code mapping ✅
│   │   │   └── city-zones.json        # Static zone map (Morocco cities) ✅
│   │   ├── services/
│   │   │   ├── carriers.ts            # Carrier CRUD ✅
│   │   │   ├── comparison.ts          # Ranking algorithm ✅
│   │   │   ├── bookings.ts            # createBooking, listShipments ✅
│   │   │   ├── commission.ts          # calculateCommission (dual-rate) ✅
│   │   │   ├── tracking.ts            # pollActiveShipments, getTrackingEvents ✅
│   │   │   ├── analytics.ts           # getAnalyticsSummary, getAnalyticsCharts ✅
│   │   │   ├── billing.ts             # getRetailersBillingOverview, createRetailerInvoice ✅
│   │   │   ├── users.ts               # getUserProfile, updateUserProfile ✅
│   │   │   └── audit.ts               # logAuditEvent (fire-and-forget) ✅ W9
│   │   ├── supabase/
│   │   │   └── client.ts              # Supabase client (Realtime) ✅
│   │   ├── notifications/
│   │   │   ├── email.ts               # Resend confirmation email ✅
│   │   │   ├── whatsapp.ts            # WhatsApp Business API ✅
│   │   │   └── web-push.ts            # sendWebPushToUser — VAPID push, auto-removes 410 subs ✅ W9
│   │   ├── utils/
│   │   │   └── clerk-webhook.ts       # Clerk user sync handler ✅
│   │   ├── utils.ts                   # Shared utility functions ✅
│   │   └── validations/
│   │       ├── carriers.ts            # Carrier + compare Zod schemas ✅
│   │       ├── shipments.ts           # BookingInput + response schemas ✅
│   │       └── users.ts               # UserProfileSchema + UserProfilePatchSchema ✅
│   ├── hooks/
│   │   ├── use-carriers.ts            # TanStack Query carrier hooks ✅
│   │   ├── use-compare.ts             # Comparison mutation hook ✅
│   │   ├── use-create-shipment.ts     # Booking mutation hook ✅
│   │   ├── use-shipments.ts           # Shipments query hook ✅
│   │   ├── use-shipment-status.ts     # Realtime + 10s polling status hook ✅
│   │   ├── use-tracking-events.ts     # Realtime INSERT events hook ✅
│   │   ├── use-analytics-summary.ts   # KPI cards query hook ✅
│   │   ├── use-analytics-charts.ts    # Chart data query hook ✅
│   │   ├── use-billing.ts             # Invoice list + create mutation hook ✅
│   │   ├── use-user-profile.ts        # Profile query + update mutation hook ✅
│   │   └── use-web-push.ts            # Web Push subscribe/unsubscribe hook ✅ W9
│   ├── middleware.ts                  # Clerk auth — protects /dashboard, /analytics, /admin ✅
│   └── test-setup.ts                  # Vitest + @testing-library/jest-dom setup
├── public/
│   └── sw.js                          # Service worker — push events + notificationclick ✅ W9
├── docs/plans/                        # Implementation plans + progress
├── docs/mds/                          # Strategic docs
├── e2e/                               # Playwright E2E specs (5 flow specs) ✅
├── lighthouserc.js                    # Lighthouse CI — tests / only (static landing page)
├── playwright.config.ts
├── drizzle.config.ts
├── vitest.config.ts
├── next.config.ts                     # CSP headers (manual, dev disabled), cron schedule
├── tsconfig.json
├── components.json                    # shadcn/ui config
├── .env.example
├── .github/workflows/ci.yml           # lint + tsc + vitest + build
├── package.json
├── pnpm-lock.yaml
├── README.md
└── CLAUDE.md
```

---

### 🎯 Quick Start

**Development Mode:**
```bash
# Clone and install
git clone <repository-url>
cd wassalha
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys (Supabase, Clerk, Google Maps, etc.)

# Start PostgreSQL (if local)
docker-compose up -d db

# Run migrations
pnpm db:migrate

# Start dev server
pnpm dev
```

**Access Points:**
- App: http://localhost:3000
- API: http://localhost:3000/api
- Drizzle Studio: `pnpm db:studio`

---

### 🔧 Environment Variables

**Required now (Phases 1–4):**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/wassalha

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Clerk redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Google Maps (address autocomplete)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Resend (booking confirmation email — optional, skipped if missing)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Wassalha <onboarding@resend.dev>

# Carrier APIs — Aramex: real SOAP adapter (W10 ✅). Others (Amana/CTM/Marocolis/Sendex): stubs, deferred pending contracts.
AMANA_API_URL=https://api.amana.ma
AMANA_API_KEY=
AMANA_ACCOUNT_ID=
ARAMEX_API_URL=https://ws.aramex.net/ShippingAPI.V2
ARAMEX_USERNAME=
ARAMEX_PASSWORD=
ARAMEX_ACCOUNT_NUMBER=
ARAMEX_ACCOUNT_PIN=
CTM_API_URL=https://api.ctm.ma
CTM_API_KEY=
MAROCOLIS_API_URL=https://api.marocolis.ma
MAROCOLIS_CLIENT_ID=
MAROCOLIS_CLIENT_SECRET=
SENDEX_API_URL=https://api.sendex.ma
SENDEX_API_TOKEN=
```

**Phase 5 (real-time tracking):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Phase 6 (billing):**
```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

**Phase 7 (WhatsApp):**
```bash
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_ID=...
WHATSAPP_TEMPLATE_NAME=shipment_notification
```

**Phase 8 (monitoring + rate limiting + E2E):**
```bash
# Sentry — DSN hardcoded in sentry.client/server/edge.config.ts
# (env var inlining issue with Vercel — do not rely on NEXT_PUBLIC_SENTRY_DSN)
SENTRY_AUTH_TOKEN=...        # Source map upload (CI)
SENTRY_ORG=...               # Org slug
SENTRY_PROJECT=...           # Project slug

# Upstash rate limiting
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# E2E test users (must have +clerk_test suffix)
E2E_RETAILER_EMAIL=retailer+clerk_test@example.com
E2E_RETAILER_PASSWORD=...
E2E_ADMIN_EMAIL=admin+clerk_test@example.com
E2E_ADMIN_PASSWORD=...
```

**W9 (web push notifications):**
```bash
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@wassalha.ma
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # same as VAPID_PUBLIC_KEY, exposed to browser
```

---

### 📊 Key Metrics & Success Criteria

- MVP launched within 8 weeks with all core features
- 20+ beta retailers onboarded and actively booking
- 95%+ delivery success rate via recommended carriers
- 20%+ average cost savings for retailers
- NPS 40+ from beta users
- Positive unit economics: commission revenue covers per-shipment costs

### 💰 Budget (8-Week Total)

| Category | DH |
|----------|---:|
| Cloud infrastructure | 4,000 |
| Google Maps API | 3,000 |
| Domain + SSL + email | 600 |
| WhatsApp Business API | 1,000 |
| Marketing (Meta ads) | 10,000 |
| Tooling (Sentry, PostHog, Clerk) | 2,000 |
| Contingency (15%) | 3,090 |
| **TOTAL** | **23,690** |
