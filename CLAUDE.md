## Project Overview
Wassalha — B2B COD Delivery Aggregator for Morocco.
Monorepo architecture: Next.js 15 full-stack with dedicated API layer.
Backend: Hono (lightweight API) + Next.js API Routes (TypeScript). Frontend: Next.js 15 App Router + React.
Domain: Carrier comparison, one-click booking, real-time tracking, commission billing.
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
- **Real-time**: Supabase Realtime (Phase 5 — not yet implemented).
- **Maps**: Google Maps API (address autocomplete, Morocco-restricted) + Mapbox (Phase 5 route visualization).
- **Payments**: Stripe (Phase 6 — commission billing invoices). Not yet integrated.
- **Email**: Resend (Phase 4 — booking confirmation). Lazy-initialized, skipped if key missing.
- **Notifications**: WhatsApp Business API (Phase 7 — recipient SMS). Not yet integrated.
- **Deployment**: Vercel (frontend) + Railway or Fly.io (backend services).
- **CI/CD**: GitHub Actions — lint + tsc + vitest + build on every push.
- **Monitoring**: Sentry (Phase 8) + PostHog (Phase 6). Not yet integrated.
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


### ⏳ Phase 5 — Real-time Tracking (Week 5)

Carrier tracking integrations, unified tracking model, live dashboard, push notifications.

### ⏳ Phase 6 — Dashboard + Analytics (Week 6)

Retailer dashboard, commission billing dashboard, charts, CSV export.

### ⏳ Phase 7 — Landing Page + Onboarding (Week 7)

Marketing landing page, onboarding wizard, help center, WhatsApp integration.

### ⏳ Phase 8 — Testing + Launch (Week 8)

E2E testing, performance optimization, security audit, beta launch to 20 retailers.

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
| Real-time GPS Tracking | ⏳ | ⏳ | Supabase Realtime + Mapbox |
| Retailer Dashboard | ⏳ | ⏳ | Shipments, spend, savings |
| Analytics + Charts | ⏳ | ⏳ | Recharts, export CSV |
| Marketing Landing Page | ⏳ | ⏳ | Full copywriting applied |
| Onboarding Wizard | ⏳ | ⏳ | 3-step setup |
| WhatsApp Notifications | ⏳ | ⏳ | WhatsApp Business API |
| Beta Launch (20 retailers) | ⏳ | ⏳ | Feedback loop active |

### 📊 Codebase Metrics

**Current (Phase 4 complete):**
- Drizzle schema: 6 tables live — users, carriers, carrier_zones, carrier_pricing, shipments, commissions
- Migrations: 4 applied (0000–0003)
- API routes: 10 endpoints live
- React components: ~15 built
- Tests: 99 passing

**Planned (Phases 5–8):**
- Additional tables: tracking_events, notifications, audit_logs
- No separate `bookings` table — booking data lives in `shipments`
- Target API routes: ~15 total
- Target components: ~25+

---

### 📦 Project Structure (actual — Phase 4)

```
wassalha/
├── src/
│   ├── app/                           # Next.js 15 App Router
│   │   ├── (dashboard)/               # Protected dashboard routes (Clerk middleware)
│   │   │   ├── layout.tsx             # Dashboard shell
│   │   │   ├── dashboard/page.tsx     # Dashboard home
│   │   │   ├── compare/               # Carrier comparison ✅
│   │   │   │   ├── page.tsx
│   │   │   │   └── compare-page-client.tsx
│   │   │   ├── shipments/page.tsx     # Shipments list ✅
│   │   │   └── admin/carriers/        # Carrier admin CRUD (admin only) ✅
│   │   ├── api/                       # Next.js API Routes
│   │   │   ├── carriers/              # Carrier CRUD + comparison ✅
│   │   │   │   ├── route.ts           # GET list, POST create
│   │   │   │   ├── [id]/route.ts      # GET, PUT, DELETE
│   │   │   │   ├── [id]/zones/        # Zone CRUD
│   │   │   │   ├── [id]/zones/[zoneId]/pricing/  # Pricing CRUD
│   │   │   │   └── compare/route.ts   # POST comparison engine
│   │   │   ├── shipments/             # Booking ✅
│   │   │   │   ├── route.ts           # POST book, GET list
│   │   │   │   └── [id]/route.ts      # GET single
│   │   │   └── webhooks/clerk/route.ts # Clerk user sync ✅
│   │   ├── sign-in/[[...sign-in]]/    # Clerk hosted sign-in
│   │   ├── sign-up/[[...sign-up]]/    # Clerk hosted sign-up
│   │   ├── layout.tsx                 # Root layout (providers)
│   │   └── page.tsx                   # Landing page (placeholder)
│   ├── components/
│   │   ├── ui/                        # shadcn/ui primitives ✅
│   │   ├── compare/                   # Comparison UI ✅
│   │   │   ├── compare-form.tsx
│   │   │   ├── results-list.tsx
│   │   │   ├── carrier-result-card.tsx
│   │   │   ├── city-autocomplete.tsx
│   │   │   └── mode-toggle.tsx
│   │   ├── booking/                   # Booking sheet ✅
│   │   │   ├── booking-sheet.tsx
│   │   │   └── booking-form.tsx
│   │   └── shipments/                 # Shipments table ✅
│   │       └── shipments-table.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema/                # users, carriers, carrier_zones,
│   │   │   │   │                      # carrier_pricing, shipments, commissions ✅
│   │   │   ├── migrations/            # 0000–0003 applied ✅
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
│   │   │   └── commission.ts          # calculateCommission (dual-rate) ✅
│   │   ├── notifications/
│   │   │   ├── email.ts               # Resend confirmation email ✅
│   │   │   └── whatsapp.ts            # WhatsApp Business API ✅
│   │   └── validations/
│   │       ├── carriers.ts            # Carrier + compare Zod schemas ✅
│   │       └── shipments.ts           # BookingInput + response schemas ✅
│   └── hooks/
│       ├── use-carriers.ts            # TanStack Query carrier hooks ✅
│       ├── use-compare.ts             # Comparison mutation hook ✅
│       ├── use-create-shipment.ts     # Booking mutation hook ✅
│       └── use-shipments.ts           # Shipments query hook ✅
├── docs/plans/                        # Implementation plans + progress
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
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

# Carrier APIs (all optional — booking returns 502 if missing)
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
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

**Phase 6 (billing):**
```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

**Phase 7 (WhatsApp):**
```bash
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_ID=...
WHATSAPP_TEMPLATE_NAME=shipment_notification
```

**Phase 8 (monitoring):**
```bash
SENTRY_DSN=https://...@sentry.io/...
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
