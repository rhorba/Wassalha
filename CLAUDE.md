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
- **API Layer**: Hono (lightweight REST API) or Next.js API Routes.
- **Database**: PostgreSQL (Supabase or Neon) + Drizzle ORM.
- **Auth**: Clerk or NextAuth.js v5.
- **Real-time**: Supabase Realtime or Socket.io for live tracking.
- **Maps**: Google Maps API or Mapbox for address autocomplete + route visualization.
- **Payments**: Stripe (commission billing) + CMI (local Moroccan cards).
- **Email/Notifications**: Resend (email) + WhatsApp Business API.
- **Deployment**: Vercel (frontend) + Railway or Fly.io (backend services).
- **CI/CD**: GitHub Actions.
- **Monitoring**: Sentry (errors) + PostHog (analytics).
- **Build**: pnpm (global package manager).

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

### ⏳ Phase 4 — Booking + Commission (Week 4)

### ⏳ Phase 4 — Booking + Commission (Week 4)

One-click booking, shipment records, commission calculation, confirmation flow.


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
| DB Schema + Migrations | ✅ | — | users + carriers + carrier_zones + carrier_pricing |
| CI/CD Pipeline | ✅ | ✅ | GitHub Actions — lint + tsc + vitest + build |
| Address Autocomplete | ✅ | ✅ | Google Places API (Morocco-restricted) + plain-text fallback |
| Carrier Database + Admin CRUD | ✅ | ✅ | 5 carriers seeded, full admin panel with RBAC |
| Carrier Comparison Engine | ✅ | ✅ | Ranking: cost, speed, reliability — 78 tests |
| One-click Booking | ⏳ | ⏳ | Booking + confirmation email |
| Commission Engine | ⏳ | ⏳ | Per-shipment commission calc |
| Real-time GPS Tracking | ⏳ | ⏳ | Supabase Realtime + Mapbox |
| Retailer Dashboard | ⏳ | ⏳ | Shipments, spend, savings |
| Analytics + Charts | ⏳ | ⏳ | Recharts, export CSV |
| Marketing Landing Page | ⏳ | ⏳ | Full copywriting applied |
| Onboarding Wizard | ⏳ | ⏳ | 3-step setup |
| WhatsApp Notifications | ⏳ | ⏳ | WhatsApp Business API |
| Beta Launch (20 retailers) | ⏳ | ⏳ | Feedback loop active |

### 📊 Codebase Metrics (Target)

**Full-Stack (TypeScript):**
- Drizzle schema: ~10 tables (users, carriers, carrier_zones, carrier_pricing, shipments, bookings, commissions, addresses, tracking_events, notifications)
- API routes: ~15 endpoints
- React components: ~25+ (pages, UI, forms, dashboards)
- Drizzle migrations: incremental per sprint

**Database tables (planned):** users, carriers, carrier_zones, carrier_pricing, shipments, bookings, commissions, addresses, tracking_events, notifications, audit_logs

---

### 📦 Project Structure

```
wassalha/
├── src/
│   ├── app/                           # Next.js 15 App Router
│   │   ├── (auth)/                    # Auth routes (login, signup)
│   │   ├── (dashboard)/               # Protected dashboard routes
│   │   │   ├── shipments/             # Shipment management
│   │   │   ├── compare/               # Carrier comparison
│   │   │   ├── tracking/              # Live tracking
│   │   │   ├── analytics/             # Dashboard + charts
│   │   │   ├── carriers/              # Carrier admin (admin only)
│   │   │   └── settings/              # User settings
│   │   ├── api/                       # API Routes (or Hono mount)
│   │   │   ├── auth/                  # Auth endpoints
│   │   │   ├── carriers/              # Carrier CRUD + comparison
│   │   │   ├── shipments/             # Booking + shipment mgmt
│   │   │   ├── tracking/              # Tracking webhooks + polling
│   │   │   ├── commissions/           # Commission calculations
│   │   │   └── webhooks/              # Carrier webhook receivers
│   │   ├── layout.tsx                 # Root layout
│   │   └── page.tsx                   # Landing page
│   ├── components/                    # Shared React components
│   │   ├── ui/                        # shadcn/ui components
│   │   ├── forms/                     # Form components
│   │   ├── maps/                      # Map components
│   │   └── charts/                    # Chart components
│   ├── lib/                           # Utilities and configs
│   │   ├── db/                        # Drizzle config + schema
│   │   │   ├── schema/                # Table definitions
│   │   │   ├── migrations/            # Drizzle Kit migrations
│   │   │   └── index.ts               # DB client
│   │   ├── auth/                      # Auth config (Clerk/NextAuth)
│   │   ├── carriers/                  # Carrier adapter pattern
│   │   │   ├── adapters/              # Per-carrier API adapters
│   │   │   └── types.ts               # Unified carrier interface
│   │   ├── services/                  # Business logic layer
│   │   ├── utils/                     # Helper functions
│   │   └── validations/               # Zod schemas
│   ├── hooks/                         # Custom React hooks
│   └── types/                         # Global TypeScript types
├── public/                            # Static assets
├── drizzle.config.ts                  # Drizzle Kit config
├── next.config.ts                     # Next.js config
├── tailwind.config.ts                 # Tailwind CSS 4 config
├── tsconfig.json                      # TypeScript config (strict)
├── .env.example                       # Environment template
├── .env.local                         # Local env (gitignored)
├── docker-compose.yml                 # PostgreSQL + services
├── .github/workflows/                 # CI/CD pipelines
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

Required for development:
```bash
# Database (Supabase or local)
DATABASE_URL=postgresql://user:password@localhost:5432/wassalha

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Stripe (commission billing)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Resend (email)
RESEND_API_KEY=re_...

# WhatsApp Business API
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_ID=...

# Supabase Realtime (tracking)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Mapbox (route visualization)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

# PostHog (analytics)
NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Sentry (error monitoring)
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
