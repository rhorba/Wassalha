# Wassalha — B2B COD Delivery Aggregator for Morocco

The only platform in Morocco that instantly compares COD delivery services, books the best one for you, and tracks every package in real time — so you ship with confidence and grow without limits.

## Overview

Wassalha is a B2B delivery aggregation platform built for Moroccan COD (Cash on Delivery) retailers. It enables sellers to input origin and destination addresses, receive a ranked list of delivery carriers (by cost, speed, and reliability), book with one click, and track shipments in real time. Wassalha earns a commission per shipment, creating a scalable revenue model.

**Target market:** Morocco's e-commerce sector where COD accounts for 80%+ of transactions. COD retailers lose 10–20% of orders to failed deliveries, with no unified platform to compare and manage carriers.

**Primary persona:** "Amine" — COD retailer, age 25-40, shipping 50-500 orders/month from Casablanca/Marrakech/Tangier, spending 2+ hours/day coordinating deliveries across multiple carriers.

---

## Implementation Status

### 8-Week MVP Sprint (March 17 – May 8, 2026)

| Week | Sprint | Status | Deliverable |
|------|--------|--------|-------------|
| W1 | Foundation + Auth | ✅ Done | Auth working, DB migrated, CI/CD live |
| W2 | Address + Carrier Data | ✅ Done | Address autocomplete + carrier CRUD + admin panel |
| W3 | Comparison Engine | ✅ Done | Ranking algorithm live — users compare carriers by cost/speed/reliability |
| W4 | Booking + Commission | ✅ Done | Full booking flow end-to-end — 99 tests passing |
| W5 | Real-time Tracking | ✅ Done | Live tracking stepper + badge — 107 tests passing |
| W6 | Dashboard + Analytics | ✅ Done | KPI dashboard + charts + Stripe billing — 146 tests passing |
| W7 | Landing Page + Onboarding | ✅ Done | Landing page (Darija + French) + 3-step onboarding + user profile API — 157 tests passing |
| W8 | Testing + Launch Prep | ✅ Done | E2E Playwright (5 specs), Lighthouse CI, CSP headers, rate limiting, Sentry, PostHog, feedback widget — 164 tests passing. Perf fix: root layout restructured — landing page now fully static. |
| W9 | Notifications + Audit + Web Push | ✅ Done | notifications table, audit_logs table, push_subscriptions table (migration 0008), web-push service, bell toggle UI, audit-logs admin page, cron trigger — 178 tests passing. All S1–S10 smoke tests passed (2026-03-20). |

### Feature Status

| Feature | API | Frontend | Priority |
|---------|:---:|:--------:|----------|
| Project scaffolding (Next.js 15 + Tailwind 4) | ✅ | ✅ | **W1** |
| DB schema (Drizzle ORM + PostgreSQL) | ✅ | — | **W1** |
| Authentication (Clerk / NextAuth v5) | ✅ | ✅ | **W1** |
| CI/CD pipeline (GitHub Actions) | ✅ | ✅ | **W1** |
| Address autocomplete (Google Maps API) | ✅ | ✅ | **W2** |
| Carrier database + admin CRUD | ✅ | ✅ | **W2** |
| Unified carrier adapter interface | ✅ | — | **W3** |
| Comparison ranking algorithm | ✅ | — | **W3** |
| Comparison results UI | — | ✅ | **W3** |
| One-click booking flow | ✅ | ✅ | **W4** |
| Commission calculation engine | ✅ | — | **W4** |
| Booking confirmation + email | ✅ | ✅ | **W4** |
| Carrier tracking API integrations | ✅ | — | **W5** |
| Live tracking dashboard | — | ✅ | **W5** |
| Web Push notifications (status changes) | ✅ | ✅ | **W9** |
| Notifications log (email/WhatsApp/web_push per shipment) | ✅ | — | **W9** |
| Audit trail (admin actions) | ✅ | ✅ | **W9** |
| Retailer dashboard (KPIs, spend, success rate) | ✅ | ✅ | **W6** |
| Commission/billing dashboard (Stripe invoices) | ✅ | ✅ | **W6** |
| Charts + CSV export (Recharts, streaming CSV) | ✅ | ✅ | **W6** |
| Marketing landing page | ✅ | ✅ | **W7** |
| Onboarding wizard (3-step) | ✅ | ✅ | **W7** |
| WhatsApp notification integration | ✅ | — | **W7** |
| E2E testing (Playwright) | ✅ | ✅ | **W8** |
| Performance optimization (Core Web Vitals) | ✅ | ✅ | **W8** |
| Security audit (OWASP basics) | ✅ | — | **W8** |
| Beta launch (20 retailers) | ✅ | ✅ | **W8** |

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) + TypeScript + React 19 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **API** | Next.js API Routes (TypeScript) |
| **Database** | PostgreSQL (Neon cloud) |
| **ORM** | Drizzle ORM + Drizzle Kit (migrations) |
| **Auth** | Clerk (hosted UI + publicMetadata role) |
| **Real-time** | Supabase Realtime (postgres_changes) + 10s polling fallback |
| **Maps** | Google Maps API (address autocomplete, Morocco-restricted) |
| **Payments** | ⏳ Deferred — Stripe removed (not available in Morocco). PayGate Africa planned after vetting. Manual invoice confirmation used for beta. |
| **Email** | Resend (booking confirmation — skipped if key missing) |
| **Notifications** | WhatsApp Business API (wired, skips if credentials missing) + Web Push API (W9 — VAPID, bell toggle) |
| **Rate limiting** | Upstash Redis (`@upstash/ratelimit` — 20 req/min on compare) |
| **Validation** | Zod (shared schemas for API + forms) |
| **Forms** | React Hook Form + Zod resolver |
| **Charts** | Recharts |
| **Deployment** | Vercel — https://wassalha.vercel.app (main branch auto-deploy) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Sentry (errors) + PostHog (analytics — EU region) |
| **Performance** | Vercel Speed Insights. Static landing page (no Clerk JS). |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **Code Quality** | ESLint + Prettier + TypeScript strict mode |

---

## Prerequisites

- **Node.js**: v20+ LTS
- **pnpm**: v9+ (`npm install -g pnpm`)
- **Git**: Run `git config --global core.autocrlf input`
- **Docker**: Optional, for local PostgreSQL
- **Accounts**: Neon (or Supabase), Clerk, Google Maps API — Stripe/Resend needed only from W4+

---

## Quick Start

### Development Mode

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wassalha
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Start PostgreSQL** (if using local Docker)
   ```bash
   docker-compose up -d db
   ```

5. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

6. **Start dev server**
   ```bash
   pnpm dev
   ```

   App runs at `http://localhost:3000`

### Docker Development Mode

```bash
# Start all services (app + PostgreSQL)
docker-compose up --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Production Deployment

```bash
# Build and deploy to Vercel
vercel --prod

# Or build locally
pnpm build
pnpm start
```

### Access Points

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API | http://localhost:3000/api |
| Drizzle Studio | `pnpm db:studio` |

---

## Project Structure

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
│   │   │   │   ├── layout.tsx         # Dashboard shell
│   │   │   │   ├── dashboard/page.tsx # Dashboard home
│   │   │   │   ├── compare/           # Carrier comparison ✅
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── compare-page-client.tsx  # Pre-fills originCity from user profile
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
│   │       │   ├── [id]/zones/route.ts           # GET, POST zones
│   │       │   ├── [id]/zones/[zoneId]/route.ts  # DELETE zone
│   │       │   ├── [id]/zones/[zoneId]/pricing/route.ts          # GET, POST pricing
│   │       │   ├── [id]/zones/[zoneId]/pricing/[pricingId]/route.ts  # DELETE pricing
│   │       │   └── compare/route.ts   # POST comparison engine (rate limited)
│   │       ├── analytics/             # Analytics ✅
│   │       │   ├── summary/route.ts   # GET KPI cards
│   │       │   └── charts/route.ts    # GET time-series + carrier breakdown
│   │       ├── shipments/             # Booking ✅
│   │       │   ├── route.ts           # POST book, GET list
│   │       │   ├── [id]/route.ts      # GET single
│   │       │   └── export/route.ts    # GET CSV download
│   │       ├── commissions/
│   │       │   └── export/route.ts    # GET CSV download (admin) ✅
│   │       ├── billing/
│   │       │   └── invoices/route.ts  # POST create Stripe invoice, GET list (admin) ✅
│   │       ├── push/                  # Web Push API ✅ W9
│   │       │   ├── vapid-public-key/route.ts
│   │       │   └── subscribe/route.ts
│   │       ├── cron/tracking/route.ts # Tracking poller (daily on Vercel Hobby) ✅
│   │       ├── mock-aramex/           # Local mock for Aramex API (dev only) ✅
│   │       │   ├── v1/shipping/shipments/create/route.ts
│   │       │   └── v1/tracking/shipments/track/route.ts
│   │       ├── users/me/route.ts      # GET + PATCH user profile ✅
│   │       ├── feedback/route.ts      # POST submit feedback (auth + Zod) ✅
│   │       └── webhooks/
│   │           ├── clerk/route.ts     # Clerk user sync ✅
│   │           └── stripe/route.ts    # Stripe invoice.paid → mark commissions paid ✅
│   ├── components/
│   │   ├── ui/                        # shadcn/ui primitives (17 components) ✅
│   │   ├── carriers/                  # Carrier admin UI ✅
│   │   │   ├── carrier-form.tsx
│   │   │   ├── carrier-table.tsx
│   │   │   └── zone-accordion.tsx
│   │   ├── compare/                   # Comparison UI ✅
│   │   │   ├── compare-form.tsx
│   │   │   ├── results-list.tsx
│   │   │   ├── carrier-result-card.tsx
│   │   │   ├── city-autocomplete.tsx
│   │   │   └── mode-toggle.tsx
│   │   ├── booking/                   # Booking sheet ✅
│   │   │   ├── booking-sheet.tsx
│   │   │   └── booking-form.tsx
│   │   ├── forms/                     # Shared form components ✅
│   │   │   └── address-autocomplete.tsx
│   │   ├── shipments/                 # Shipments table ✅
│   │   │   ├── shipments-table.tsx
│   │   │   └── status-badge.tsx       # Color-coded status badge ✅
│   │   ├── tracking/                  # Tracking UI ✅
│   │   │   ├── tracking-timeline.tsx  # Live stepper component ✅
│   │   │   └── live-shipment-detail.tsx # LiveStatusBadge (Realtime + polling) ✅
│   │   ├── dashboard/                 # KPI dashboard ✅
│   │   │   ├── stat-card.tsx          # Reusable metric card
│   │   │   └── kpi-row.tsx            # 6-card retailer row + 3-card admin pipeline
│   │   ├── analytics/                 # Analytics charts ✅
│   │   │   ├── chart-panel.tsx        # Tabbed chart panel (TanStack Query)
│   │   │   ├── date-range-picker.tsx  # Popover date range selector
│   │   │   └── charts/
│   │   │       ├── volume-chart.tsx   # BarChart — shipments/week
│   │   │       ├── spend-chart.tsx    # LineChart — spend + commission dual-axis
│   │   │       └── carrier-chart.tsx  # PieChart — carrier breakdown
│   │   ├── billing/                   # Billing UI (admin) ✅
│   │   │   ├── retailer-billing-table.tsx  # Generate Stripe invoice per retailer
│   │   │   └── invoice-history-table.tsx   # Stripe invoice list + PDF links
│   │   ├── notifications/             # Notification UI ✅ W9
│   │   │   └── push-toggle.tsx        # Bell toggle (subscribe/unsubscribe web push)
│   │   └── feedback/                  # Feedback widget ✅
│   │       └── feedback-button.tsx    # Fixed-bottom-right popover (RHF + Zod + sonner)
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
│   │   │   ├── commission.ts          # calculateCommission (dual-rate: 10% + 1.5% COD) ✅
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
│   │   │   └── web-push.ts            # sendWebPushToUser — VAPID push, 410 cleanup ✅ W9
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
├── docs/mds/                          # Strategic docs (charter, stakeholder register)
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
├── CLAUDE.md
└── README.md
```

---

## API Endpoints

### Live (Phase 1–7)

#### User Profile (Phase 7)
```
GET    /api/users/me                Get current user's profile (business name, phone, default address)
PATCH  /api/users/me                Update profile — partial, Zod-validated, Clerk-authed
```

#### Carriers
```
GET    /api/carriers                        List active carriers
POST   /api/carriers                        Create carrier (admin)
GET    /api/carriers/:id                    Get carrier + zones + pricing
PUT    /api/carriers/:id                    Update carrier (admin)
DELETE /api/carriers/:id                    Soft-delete carrier (admin)
GET    /api/carriers/:id/zones              List zones
POST   /api/carriers/:id/zones              Create zone (admin)
DELETE /api/carriers/:id/zones/:zoneId      Delete zone (admin)
POST   /api/carriers/:id/zones/:zoneId/pricing        Add pricing tier (admin)
DELETE /api/carriers/:id/zones/:zoneId/pricing/:pId   Delete pricing tier (admin)
POST   /api/carriers/compare                Compare carriers for a route + weight
```

#### Shipments & Booking
```
POST   /api/shipments               Book carrier → creates shipment + commission record
GET    /api/shipments               List shipments (retailer: own; admin: all) — paginated
GET    /api/shipments/:id           Get single shipment
```

#### Tracking (Phase 5)
```
GET    /api/cron/tracking           Cron job — poll active shipments, upsert tracking_events
                                    Protected: Authorization: Bearer <CRON_SECRET>
                                    Schedule: every hour (vercel.json)
```

#### Auth Sync
```
POST   /api/webhooks/clerk          Clerk webhook — sync user to DB on sign-up
```

#### Analytics (Phase 6)
```
GET    /api/analytics/summary       KPI cards — totals, rates, commission pipeline (RBAC)
GET    /api/analytics/charts        Time-series + carrier breakdown (date range filter)
```

#### CSV Export (Phase 6)
```
GET    /api/shipments/export        Download shipments CSV (retailer: own; admin: all)
GET    /api/commissions/export      Download commissions CSV (admin only)
```

#### Billing (Phase 6)
```
POST   /api/billing/invoices        Create Stripe invoice for a retailer (admin only)
GET    /api/billing/invoices        List Stripe invoices with status (admin only)
POST   /api/webhooks/stripe         Stripe webhook — invoice.paid → marks commissions paid
```

#### Feedback (Phase 8)
```
POST   /api/feedback                 Submit in-app feedback (auth + Zod-validated, 10–500 chars)
```

#### Web Push (W9)
```
GET    /api/push/vapid-public-key    Return VAPID public key to browser (auth required, 503 if not configured)
POST   /api/push/subscribe           Upsert push subscription (Zod-validated)
DELETE /api/push/subscribe           Remove push subscription by endpoint
```

---

## Database Schema

| Table | Status | Description |
|-------|:------:|-------------|
| `users` | ✅ Live | Retailer accounts synced from Clerk. Phase 7: +`business_name`, `phone`, `default_sender_address`, `default_sender_city` |
| `carriers` | ✅ Live | 5 carriers seeded (Amana, Aramex, CTM, Marocolis, Sendex) |
| `carrier_zones` | ✅ Live | Coverage zones per carrier |
| `carrier_pricing` | ✅ Live | Pricing tiers per zone (stored in centimes) |
| `shipments` | ✅ Live | Shipment records — status, recipient, tracking number, COD amount |
| `commissions` | ✅ Live | Per-shipment commission (10% shipping + 1.5% COD) — `stripeInvoiceId` added W6 |
| `tracking_events` | ✅ Live | Status change history per shipment — upsert keyed on (shipment_id, occurred_at, carrier_raw_status) |
| `feedback` | ✅ Live | In-app feedback submissions (userId, message, page, createdAt) — migration 0007 |
| `notifications` | ✅ Live | Notification log — channel (email/whatsapp/web_push) + status per shipment — migration 0008 |
| `audit_logs` | ✅ Live | Admin action audit trail (carrier CRUD, invoices, role changes) — migration 0008 |
| `push_subscriptions` | ✅ Live | Browser VAPID push subscriptions per user — migration 0008 |

---

## Environment Variables

| Variable | When needed | Description |
|----------|:-----------:|-------------|
| `DATABASE_URL` | ✅ Now | PostgreSQL connection string — use Supabase **transaction-mode pooler** (port **6543**) for serverless/Vercel: `postgresql://postgres.PROJECT@aws-1-eu-west-1.pooler.supabase.com:6543/postgres` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Now | Clerk public key |
| `CLERK_SECRET_KEY` | ✅ Now | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | ✅ Now | Clerk webhook signing secret |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ Now | Clerk sign-in page path (e.g. `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ Now | Clerk sign-up page path (e.g. `/sign-up`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | ✅ Now | Post sign-in redirect (e.g. `/dashboard`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | ✅ Now | Post sign-up redirect — set to `/onboarding` (Phase 7+) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ Now | Google Maps API key (address autocomplete) |
| `RESEND_API_KEY` | ✅ W4 | Resend email API key — booking confirmation emails |
| `RESEND_FROM_EMAIL` | ✅ W4 | Sender address (use `onboarding@resend.dev` until domain verified) |
| `AMANA_API_URL` / `AMANA_API_KEY` / `AMANA_ACCOUNT_ID` | ⏳ Deferred | Amana Maroc — requires carrier partnership + contract |
| `ARAMEX_API_URL` / `ARAMEX_USERNAME` / `ARAMEX_PASSWORD` / `ARAMEX_ACCOUNT_NUMBER` / `ARAMEX_ACCOUNT_PIN` | ⏳ Deferred | Aramex — mock used for beta (`/api/mock-aramex`). Real credentials deferred. |
| `CTM_API_URL` / `CTM_API_KEY` | ⏳ Deferred | CTM Messagerie — requires carrier partnership + contract |
| `MAROCOLIS_API_URL` / `MAROCOLIS_CLIENT_ID` / `MAROCOLIS_CLIENT_SECRET` | ⏳ Deferred | Marocolis — requires carrier partnership + contract |
| `SENDEX_API_URL` / `SENDEX_API_TOKEN` | ⏳ Deferred | Sendex — requires carrier partnership + contract |
| `WHATSAPP_API_TOKEN` | ⏭ Skipped | Meta account restricted from creating Business Portfolio. Appeal submitted. Code skips gracefully if missing. |
| `WHATSAPP_PHONE_ID` | ⏭ Skipped | Same as above |
| `WHATSAPP_TEMPLATE_NAME` | ⏭ Skipped | Same as above |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ W5 | Supabase project URL (real-time tracking) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ W5 | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ W5 | Supabase service role key |
| `CRON_SECRET` | ✅ W5 | Bearer token protecting `/api/cron/tracking` — generate with `openssl rand -hex 32` |
| `VAPID_PUBLIC_KEY` | ✅ W9 | VAPID public key — generate with `npx web-push generate-vapid-keys`. Must be unpadded base64url (no `=`). |
| `VAPID_PRIVATE_KEY` | ✅ W9 | VAPID private key — same format |
| `VAPID_SUBJECT` | ✅ W9 | VAPID subject — e.g. `mailto:admin@wassalha.ma` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ W9 | Same value as `VAPID_PUBLIC_KEY`, exposed to browser for push subscription |
| `STRIPE_SECRET_KEY` | ⏳ Deferred | Stripe not supported in Morocco — migration to PayGate Africa planned |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⏳ Deferred | Same as above |
| `STRIPE_WEBHOOK_SECRET` | ⏳ Deferred | Same as above |
| `NEXT_PUBLIC_POSTHOG_KEY` | W8 | PostHog analytics key |
| `NEXT_PUBLIC_SENTRY_DSN` | W8 | Sentry DSN — **hardcoded** in `sentry.client/server/edge.config.ts` (env var inlining unreliable on Vercel). Set anyway as fallback. |
| `SENTRY_AUTH_TOKEN` | W8 CI | Source map upload — get from sentry.io → Settings → Auth Tokens |
| `SENTRY_ORG` | W8 CI | Sentry organization slug (from sentry.io URL) |
| `SENTRY_PROJECT` | W8 CI | Sentry project slug |
| `UPSTASH_REDIS_REST_URL` | W8 | Rate limiting — get from upstash.com → Create Database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | W8 | Rate limiting — from same Upstash REST API page |
| `E2E_RETAILER_EMAIL` | W8 CI | Clerk test user email — must end in `+clerk_test` (see E2E setup in signoff plan) |
| `E2E_RETAILER_PASSWORD` | W8 CI | Clerk test user password |
| `E2E_ADMIN_EMAIL` | W8 CI | Clerk admin test user email — must end in `+clerk_test` |
| `E2E_ADMIN_PASSWORD` | W8 CI | Clerk admin test user password |

---

## Development Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server (port 3000)
pnpm build                  # Production build
pnpm start                  # Start production server
pnpm lint                   # ESLint check
pnpm typecheck              # TypeScript type checking (tsc --noEmit)

# Database
pnpm db:generate            # Generate Drizzle migration from schema changes
pnpm db:migrate             # Apply pending migrations
pnpm db:studio              # Open Drizzle Studio GUI
pnpm db:seed                # Seed carriers + test data

# Testing
pnpm test                   # Run Vitest (watch mode)
pnpm test:run               # Run Vitest once (CI mode)
pnpm test:e2e               # Run Playwright E2E tests (requires E2E_* env vars set)

# Docker
docker-compose up -d db     # Start PostgreSQL only
docker-compose up --build   # Start full stack
docker-compose down         # Stop all
```

---

## Architecture

### Full-Stack — Next.js 15 App Router

```
middleware.ts            → Clerk auth — protects /dashboard and /admin routes
app/layout.tsx           → Minimal HTML shell only — no providers, no Clerk JS
app/page.tsx             → Static landing page — pre-renders at build time (no auth dependency)
app/(app)/layout.tsx     → App shell — ClerkProvider + TanStack Query + Toaster + SpeedInsights
app/(app)/(dashboard)/   → Protected dashboard routes
app/(app)/(auth)/        → Clerk hosted sign-in / sign-up pages
app/(app)/onboarding/    → 3-step onboarding wizard
app/api/                 → REST API routes (thin controllers → services)
lib/services/            → Business logic (comparison, booking, tracking, etc.)
lib/db/schema/           → Drizzle ORM table definitions
lib/carriers/            → Unified carrier adapter pattern
lib/supabase/            → Supabase client (Realtime subscriptions)
lib/validations/         → Zod schemas (shared API + form validation)
components/              → Reusable React components (shadcn/ui based)
hooks/                   → Custom hooks (TanStack Query, Supabase subscriptions)
```

**Key constraints:**
- No business logic in API route handlers — delegate to service layer
- Drizzle ORM only — no raw SQL unless for complex aggregations
- Drizzle Kit for all schema migrations — no `db push` in production
- Zod schemas shared between API validation and form validation
- All API routes validate input with Zod before processing
- Carrier integrations abstracted behind unified adapter interface
- TypeScript strict mode — no `any` types

### Carrier Adapter Pattern

Each carrier integration implements a unified interface (`src/lib/carriers/types.ts`):

```typescript
interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  // getTrackingStatus() — Phase 5
}

class CarrierApiError extends Error {
  code: "AUTH_FAILED" | "INVALID_ADDRESS" | "SERVICE_UNAVAILABLE" | "UNKNOWN";
}
```

5 adapters live: **Amana, Aramex, CTM, Marocolis, Sendex** (`src/lib/carriers/adapters/`).
Aramex has full `getTrackingStatus()` implementation. Others have stubs (throw `SERVICE_UNAVAILABLE`).
New carriers are added by implementing this interface — zero changes to core logic.

---

## Code Quality

- **ESLint**: Strict rules for TypeScript + React + Next.js
- **Prettier**: Consistent formatting
- **TypeScript strict mode**: `strict: true`, no implicit any
- **Zod**: Runtime validation for all API inputs
- **Vitest**: Unit tests with coverage targets
- **Playwright**: E2E tests for critical flows
- **GitHub Actions**: CI runs lint + typecheck + test on every PR

---

## Success Criteria

- MVP launched within 8 weeks with all core features functional
- 20+ beta retailers onboarded and actively booking shipments
- 95%+ delivery success rate via recommended carriers
- Retailers report average 20%+ cost savings vs. their previous setup
- Net Promoter Score of 40+ from beta users
- Positive unit economics: commission revenue covers per-shipment costs

---

## Deferred — Future Work

Items are grouped by what's blocking them.

---

### Manual Setup — No Code Required

#### Custom Domain

**Status:** ⏳ To do

Currently live at `https://wassalha.vercel.app`. A custom domain should be set before public launch.

**Recommended:** `wassalha.ma` — official Moroccan `.ma` domain, builds trust with local retailers (~200 MAD/year).

**Steps:**
1. Buy domain from [registre.ma](https://registre.ma) (for `.ma`) or Namecheap/GoDaddy (for `.com`)
2. Vercel → wassalha project → Settings → Domains → Add domain
3. Copy the A record or CNAME Vercel provides → paste into registrar DNS settings
4. Propagates in 5–30 min

---

### Blocked on External Factors — Code Complete or Mostly Complete

These items are blocked by external prerequisites (contracts, restrictions, research). Do not implement until the prerequisites are met.

#### Payment Collection — PayGate Africa (replaces Stripe)

**Status:** ⏳ Deferred — research required

Stripe is not available for Morocco-based merchants. The current billing UI (`/admin/billing`) has the Stripe integration stubbed out. For the beta, invoice confirmation is handled manually by the admin.

**Planned migration:** Stripe → PayGate Africa (or CMI if PayGate Africa doesn't support Morocco merchants)

**Prerequisites before implementing:**
- Confirm PayGate Africa accepts Morocco as merchant country
- Confirm REST API supports invoice/payment link creation
- Identify webhook event equivalent to `invoice.paid`
- Confirm sandbox/test mode availability

**Code required:** Yes — `src/lib/services/billing.ts`, `src/app/api/billing/invoices/route.ts`, `src/app/api/webhooks/stripe/route.ts`

#### Carrier API Integrations (Amana, CTM, Marocolis, Sendex)

**Status:** ⏳ Deferred — carrier partnerships required

The adapter pattern is fully implemented (`src/lib/carriers/adapters/`). All 4 carriers have stubs that throw `SERVICE_UNAVAILABLE`. Aramex has a mock for local development. Real integrations require:
- Signed API contracts with each carrier
- Live credentials (API keys, account IDs)
- Testing against carrier sandbox environments

**Code required:** Minimal — fill in `createShipment()` + `getTrackingStatus()` per adapter, set env vars. No structural changes needed.

#### WhatsApp Status Notifications

**Status:** ⏭ Skipped — Meta account restricted

WhatsApp booking confirmation (W4) and recipient notification (W7) are wired and skip gracefully if credentials are missing. Blocked by Meta Business Portfolio restriction (appeal submitted 2026-03-18).

**Code required:** None — already implemented in `src/lib/notifications/whatsapp.ts`. Just set `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_ID` once Meta resolves the restriction.

---

---

## License

MIT License

---

## Acknowledgments

Built for the Moroccan COD e-commerce ecosystem. Bilingual support (French/Darija). Designed to help small and medium retailers ship smarter, not harder.

*Confidential — Wassalha 2026*
