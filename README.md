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
| W5 | Real-time Tracking | ⏳ Planned | Live tracking dashboard working |
| W6 | Dashboard + Analytics | ⏳ Planned | Full analytics dashboard live |
| W7 | Landing Page + Onboarding | ⏳ Planned | Landing page live, onboarding flow complete |
| W8 | Testing + Launch Prep | ⏳ Planned | Beta live with 20 users, feedback loop active |

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
| Carrier tracking API integrations | ⏳ | — | **W5** |
| Live tracking dashboard | — | ⏳ | **W5** |
| Push notifications (status changes) | ⏳ | ⏳ | **W5** |
| Retailer dashboard (shipments, spend, savings) | ⏳ | ⏳ | **W6** |
| Commission/billing dashboard | ⏳ | ⏳ | **W6** |
| Charts + CSV export | — | ⏳ | **W6** |
| Marketing landing page | — | ⏳ | **W7** |
| Onboarding wizard (3-step) | — | ⏳ | **W7** |
| WhatsApp notification integration | ⏳ | — | **W7** |
| E2E testing (Playwright) | ⏳ | ⏳ | **W8** |
| Performance optimization (Core Web Vitals) | — | ⏳ | **W8** |
| Security audit (OWASP basics) | ⏳ | — | **W8** |
| Beta launch (20 retailers) | ⏳ | ⏳ | **W8** |

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) + TypeScript + React 19 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **API** | Hono (lightweight REST) or Next.js API Routes |
| **Database** | PostgreSQL (Supabase / Neon) |
| **ORM** | Drizzle ORM + Drizzle Kit (migrations) |
| **Auth** | Clerk or NextAuth.js v5 |
| **Real-time** | Supabase Realtime / Socket.io |
| **Maps** | Google Maps API / Mapbox |
| **Payments** | Stripe + CMI (local Moroccan cards) |
| **Email** | Resend |
| **Notifications** | WhatsApp Business API |
| **Validation** | Zod (shared schemas for API + forms) |
| **Forms** | React Hook Form + Zod resolver |
| **Charts** | Recharts |
| **Deployment** | Vercel (app) + Railway / Fly.io (services) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Sentry (errors) + PostHog (analytics) |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **Code Quality** | ESLint + Prettier + TypeScript strict mode |

---

## Prerequisites

- **Node.js**: v20+ LTS
- **pnpm**: v9+ (`npm install -g pnpm`)
- **Git**: Run `git config --global core.autocrlf input`
- **Docker**: Optional, for local PostgreSQL
- **Accounts**: Supabase (or Neon), Clerk, Google Maps API, Stripe, Resend

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
│   │   ├── (auth)/                    # Auth group (login, signup)
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/               # Protected routes
│   │   │   ├── layout.tsx             # Dashboard shell (sidebar, header)
│   │   │   ├── page.tsx               # Dashboard home
│   │   │   ├── compare/               # Carrier comparison
│   │   │   │   └── page.tsx
│   │   │   ├── shipments/             # Shipment list + details
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── tracking/              # Live tracking map
│   │   │   │   └── page.tsx
│   │   │   ├── analytics/             # Charts + reports
│   │   │   │   └── page.tsx
│   │   │   ├── carriers/              # Carrier admin (admin only)
│   │   │   │   └── page.tsx
│   │   │   └── settings/              # User settings
│   │   │       └── page.tsx
│   │   ├── api/                       # API Routes
│   │   │   ├── auth/[...nextauth]/    # NextAuth catch-all (if not Clerk)
│   │   │   ├── carriers/
│   │   │   │   ├── route.ts           # GET (list), POST (create)
│   │   │   │   ├── [id]/route.ts      # GET, PUT, DELETE
│   │   │   │   └── compare/route.ts   # POST (comparison engine)
│   │   │   ├── shipments/
│   │   │   │   ├── route.ts           # GET (list), POST (book)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts       # GET, PUT
│   │   │   │       └── track/route.ts # GET (tracking status)
│   │   │   ├── commissions/
│   │   │   │   └── route.ts           # GET (billing dashboard)
│   │   │   ├── tracking/
│   │   │   │   └── webhook/route.ts   # POST (carrier webhooks)
│   │   │   └── analytics/
│   │   │       └── route.ts           # GET (stats + charts data)
│   │   ├── layout.tsx                 # Root layout (providers, fonts)
│   │   └── page.tsx                   # Marketing landing page
│   │
│   ├── components/                    # Shared components
│   │   ├── ui/                        # shadcn/ui primitives
│   │   ├── forms/                     # AddressInput, BookingForm, etc.
│   │   ├── maps/                      # MapView, RouteDisplay
│   │   ├── charts/                    # DeliveryChart, CostTrend, etc.
│   │   ├── carriers/                  # CarrierCard, ComparisonList
│   │   ├── tracking/                  # TrackingTimeline, StatusBadge
│   │   └── layout/                    # Sidebar, Header, MobileNav
│   │
│   ├── lib/                           # Core logic + config
│   │   ├── db/
│   │   │   ├── schema/                # Drizzle table definitions
│   │   │   │   ├── users.ts
│   │   │   │   ├── carriers.ts
│   │   │   │   ├── shipments.ts
│   │   │   │   ├── bookings.ts
│   │   │   │   ├── commissions.ts
│   │   │   │   ├── tracking-events.ts
│   │   │   │   └── index.ts           # Re-export all schemas
│   │   │   ├── migrations/            # Drizzle Kit generated SQL
│   │   │   └── index.ts               # DB client singleton
│   │   ├── auth/                      # Clerk or NextAuth config
│   │   ├── carriers/
│   │   │   ├── adapters/              # Per-carrier API adapters
│   │   │   │   ├── amana.ts
│   │   │   │   ├── ctm-express.ts
│   │   │   │   └── base.ts            # Abstract adapter class
│   │   │   ├── ranking.ts             # Comparison algorithm
│   │   │   └── types.ts               # Unified CarrierQuote type
│   │   ├── services/                  # Business logic
│   │   │   ├── comparison.service.ts
│   │   │   ├── booking.service.ts
│   │   │   ├── tracking.service.ts
│   │   │   ├── commission.service.ts
│   │   │   └── notification.service.ts
│   │   ├── validations/               # Zod schemas
│   │   │   ├── carrier.schema.ts
│   │   │   ├── shipment.schema.ts
│   │   │   ├── booking.schema.ts
│   │   │   └── address.schema.ts
│   │   └── utils/                     # Helpers
│   │       ├── format.ts              # Currency (DH), date formatting
│   │       ├── maps.ts                # Google Maps helpers
│   │       └── constants.ts           # App-wide constants
│   │
│   ├── hooks/                         # Custom React hooks
│   │   ├── use-carriers.ts            # TanStack Query for carriers
│   │   ├── use-shipments.ts           # TanStack Query for shipments
│   │   ├── use-tracking.ts            # Supabase Realtime subscription
│   │   └── use-analytics.ts           # Dashboard data hooks
│   │
│   └── types/                         # Global TypeScript types
│       ├── carrier.ts
│       ├── shipment.ts
│       ├── tracking.ts
│       └── index.ts
│
├── public/                            # Static assets (logos, images)
├── docs/
│   └── plans/                         # Implementation plans
├── drizzle.config.ts                  # Drizzle Kit configuration
├── next.config.ts                     # Next.js configuration
├── tailwind.config.ts                 # Tailwind CSS 4 configuration
├── tsconfig.json                      # TypeScript strict config
├── vitest.config.ts                   # Vitest configuration
├── playwright.config.ts               # Playwright E2E config
├── docker-compose.yml                 # Local PostgreSQL + services
├── .env.example                       # Environment variable template
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Lint + type-check + test
│       └── deploy.yml                 # Vercel deployment
├── .eslintrc.json                     # ESLint config
├── .prettierrc                        # Prettier config
├── .gitattributes                     # LF enforcement
├── package.json
├── pnpm-lock.yaml
├── CLAUDE.md                          # AI assistant context
└── README.md                          # This file
```

---

## API Endpoints

### Live (Phase 1–4)

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

#### Auth Sync
```
POST   /api/webhooks/clerk          Clerk webhook — sync user to DB on sign-up
```

### Planned (Phase 5+)
```
GET    /api/shipments/:id/track     Tracking status + events (Phase 5)
POST   /api/tracking/webhook        Carrier status webhooks (Phase 5)
GET    /api/commissions             Billing dashboard data (Phase 6)
GET    /api/analytics               Retailer analytics (Phase 6)
```

---

## Database Schema

| Table | Status | Description |
|-------|:------:|-------------|
| `users` | ✅ Live | Retailer accounts synced from Clerk via webhook |
| `carriers` | ✅ Live | 5 carriers seeded (Amana, Aramex, CTM, Marocolis, Sendex) |
| `carrier_zones` | ✅ Live | Coverage zones per carrier |
| `carrier_pricing` | ✅ Live | Pricing tiers per zone (stored in centimes) |
| `shipments` | ✅ Live | Shipment records — status, recipient, tracking number, COD amount |
| `commissions` | ✅ Live | Per-shipment commission (10% shipping + 1.5% COD) |
| `tracking_events` | ⏳ W5 | Status change history per shipment |
| `notifications` | ⏳ W7 | WhatsApp/email notification log |
| `audit_logs` | ⏳ W8 | System audit trail |

---

## Environment Variables

| Variable | When needed | Description |
|----------|:-----------:|-------------|
| `DATABASE_URL` | ✅ Now | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Now | Clerk public key |
| `CLERK_SECRET_KEY` | ✅ Now | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | ✅ Now | Clerk webhook signing secret |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ Now | Google Maps API key (address autocomplete) |
| `RESEND_API_KEY` | W4+ | Resend email API key — booking confirmation emails |
| `RESEND_FROM_EMAIL` | W4+ | Sender address (use `onboarding@resend.dev` until domain verified) |
| `AMANA_API_URL` / `AMANA_API_KEY` / `AMANA_ACCOUNT_ID` | W4+ | Amana Maroc carrier credentials |
| `ARAMEX_API_URL` / `ARAMEX_USERNAME` / `ARAMEX_PASSWORD` / `ARAMEX_ACCOUNT_NUMBER` / `ARAMEX_ACCOUNT_PIN` | W4+ | Aramex carrier credentials |
| `CTM_API_URL` / `CTM_API_KEY` | W4+ | CTM Messagerie carrier credentials |
| `MAROCOLIS_API_URL` / `MAROCOLIS_CLIENT_ID` / `MAROCOLIS_CLIENT_SECRET` | W4+ | Marocolis carrier credentials |
| `SENDEX_API_URL` / `SENDEX_API_TOKEN` | W4+ | Sendex carrier credentials |
| `WHATSAPP_API_TOKEN` | W7+ | WhatsApp Business API token (Meta) |
| `WHATSAPP_PHONE_ID` | W7+ | WhatsApp phone number ID |
| `WHATSAPP_TEMPLATE_NAME` | W7+ | Approved message template name |
| `NEXT_PUBLIC_SUPABASE_URL` | W5+ | Supabase project URL (real-time tracking) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | W5+ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | W5+ | Supabase service role key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | W5+ | Mapbox access token (route visualization) |
| `STRIPE_SECRET_KEY` | W6+ | Stripe secret (commission billing invoices) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | W6+ | Stripe public key |
| `NEXT_PUBLIC_POSTHOG_KEY` | W6+ | PostHog analytics key |
| `SENTRY_DSN` | W8+ | Sentry error tracking DSN |

---

## Development Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server (port 3000)
pnpm build                  # Production build
pnpm start                  # Start production server
pnpm lint                   # ESLint check
pnpm lint:fix               # Auto-fix lint issues
pnpm format                 # Prettier format
pnpm typecheck              # TypeScript type checking

# Database
pnpm db:generate            # Generate Drizzle migration from schema changes
pnpm db:migrate             # Apply pending migrations
pnpm db:push                # Push schema directly (dev only, NOT for production)
pnpm db:studio              # Open Drizzle Studio GUI
pnpm db:seed                # Seed carriers + test data

# Testing
pnpm test                   # Run Vitest unit tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report
pnpm test:e2e               # Playwright E2E tests
pnpm test:e2e:ui            # Playwright with UI

# Docker
docker-compose up -d db     # Start PostgreSQL only
docker-compose up --build   # Start full stack
docker-compose down         # Stop all
```

---

## Architecture

### Full-Stack — Next.js 15 App Router

```
app/                → Pages (RSC by default, client where needed)
app/api/            → REST API routes (thin controllers → services)
lib/services/       → Business logic (comparison, booking, tracking)
lib/db/schema/      → Drizzle ORM table definitions
lib/carriers/       → Unified carrier adapter pattern
lib/validations/    → Zod schemas (shared API + form validation)
components/         → Reusable React components (shadcn/ui based)
hooks/              → Custom hooks (TanStack Query, Supabase subscriptions)
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

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Carrier API unavailability | High | High | Manual booking fallback; web scraping adapters as backup |
| Low retailer adoption | Medium | High | Pre-launch WhatsApp outreach; free first 50 shipments |
| Scope creep beyond MVP | High | Medium | Strict sprint scope; PM gatekeeps additions; defer to Phase 2 |
| Carrier pricing changes | Medium | Medium | Automated sync where APIs exist; weekly manual audits |
| Team bandwidth | Medium | High | Document decisions; pair programming; cross-train |
| Regulatory requirements | Low | High | Early legal consultation on commission model |

---

## Success Criteria

- MVP launched within 8 weeks with all core features functional
- 20+ beta retailers onboarded and actively booking shipments
- 95%+ delivery success rate via recommended carriers
- Retailers report average 20%+ cost savings vs. their previous setup
- Net Promoter Score of 40+ from beta users
- Positive unit economics: commission revenue covers per-shipment costs

---

## License

MIT License

---

## Acknowledgments

Built for the Moroccan COD e-commerce ecosystem. Bilingual support (French/Darija). Designed to help small and medium retailers ship smarter, not harder.

*Confidential — Wassalha 2026*
