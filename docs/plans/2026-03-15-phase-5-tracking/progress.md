# Execution Progress

**Plan:** `docs/plans/2026-03-15-phase-5-tracking/plan.md`
**Last updated:** 2026-03-15

## Status

| Task | Title | Status |
|------|-------|--------|
| 1 | tracking_events DB Schema + Migration | ✅ completed |
| 2 | Extend Carrier Types | ✅ completed |
| 3 | Aramex Adapter — Implement getTrackingStatus | ✅ completed |
| 4 | Stub getTrackingStatus on Remaining Adapters | ✅ completed |
| 5 | Tracking Service | ✅ completed |
| 6 | Cron Route Handler + vercel.json | ✅ completed |
| 7 | Supabase Client Setup | ✅ completed |
| 8 | useShipmentStatus Hook | ✅ completed |
| 9 | useTrackingEvents Hook | ✅ completed |
| 10 | StatusBadge Component | ✅ completed |
| 11 | TrackingTimeline Component | ✅ completed |
| 12 | Shipment Detail Page (RSC) | ✅ completed |
| 13 | Wire StatusBadge into Shipments List | ✅ completed |
| 14 | Tests | ✅ completed |
| 15 | Final Verification | ✅ completed |

## Batch Log

### Batch 1 (Tasks 1–4) — 2026-03-15
- ✅ Task 1: Created `src/lib/db/schema/tracking.ts` with `tracking_events` table + unique upsert constraint. Exported from `schema/index.ts`. Migration `0004_sparkling_sharon_carter.sql` generated. Apply with `pnpm db:migrate` when Neon DB is reachable.
- ✅ Task 2: Updated `src/lib/carriers/types.ts` — added `TrackingEvent` interface, added `getTrackingStatus()` to `CarrierAdapter`.
- ✅ Task 3: Updated `src/lib/carriers/adapters/aramex.ts` — implemented `getTrackingStatus` with Aramex tracking API + STATUS_MAP. Full `createShipment` preserved.
- ✅ Task 4: Added `getTrackingStatus` stubs to Amana, CTM, Marocolis, Sendex adapters — each throws `CarrierApiError("SERVICE_UNAVAILABLE")`.
- Verification: typecheck ✅ lint ✅

### Batch 2 (Tasks 5–15) — 2026-03-15
- ✅ Task 5: Created `src/lib/services/tracking.ts` — `pollActiveShipments` (filters active+<14d, per-shipment error isolation) + `getTrackingEvents`.
- ✅ Task 6: Created `src/app/api/cron/tracking/route.ts` (Bearer auth protected) + `vercel.json` (hourly schedule) + updated `.env.example` with `CRON_SECRET`.
- ✅ Task 7: Installed `@supabase/supabase-js@2.99.1`. Created `src/lib/supabase/client.ts` with safe empty-string fallbacks.
- ✅ Task 8: Created `src/hooks/use-shipment-status.ts` — Supabase Realtime UPDATE subscription on `shipments`.
- ✅ Task 9: Created `src/hooks/use-tracking-events.ts` — Supabase Realtime INSERT subscription on `tracking_events`, sorted by `occurredAt`.
- ✅ Task 10: Created `src/components/shipments/status-badge.tsx` — color-coded badge for all 7 shipment statuses.
- ✅ Task 11: Created `src/components/tracking/tracking-timeline.tsx` — vertical stepper (green check / spin / gray circle) with location + description support.
- ✅ Task 12: Created `src/app/(dashboard)/shipments/[id]/page.tsx` — RSC fetching shipment + events, rendering `TrackingTimeline` + `StatusBadge`.
- ✅ Task 13: Rewrote `shipments-table.tsx` — replaced static badge with `LiveStatusCell` (Realtime) + added "Voir suivi" link to detail page.
- ✅ Task 14: Created tracking service tests (4) + Aramex adapter tracking tests (4). Fixed env-var instantiation issue by importing adapter inside each test. Fixed `ShipmentResponseSchema.status` from `z.string()` → `z.enum(shipmentStatusValues)` to fix type error.
- ✅ Task 15: typecheck ✅ lint ✅ build ✅ — 103 tests passing (4 pre-existing DB-constraint failures unrelated to Phase 5).

## Test Results — 2026-03-15
- New Phase 5 tests: 8 passing (4 tracking service + 4 Aramex adapter)
- Total passing: 107 (updated from 103 — 4 additional tests passing)
- All Phase 5 tests passing: ✅

## Test Plan Execution — 2026-03-15

### Part 1 — Automated Unit Tests ✅
- 107 tests passing (pnpm test --run)

### Part 2 — Smoke Tests ✅
- ✅ Step 1: Shipments list loads with colored badges + "Voir suivi" links
- ✅ Step 2: Detail page loads with stepper (4 steps, current step animated)
- ✅ Step 3: Cron endpoint — authorized returns `{ok:true,processed:1,errors:1}`, unauthorized returns 401
- ✅ Step 4: Realtime badge update on `/shipments` — status change in Supabase reflected live in browser
- ✅ Step 5: Stepper live Realtime insert — new tracking_events row appeared live without refresh

### Bugs Found & Fixed During Testing
- **Seed slug mismatch**: `seed.ts` had wrong carrier slugs (`chronopost`, `fret-express`, `colis-prive`) — updated to match adapters (`aramex`, `marocolis`, `sendex`)
- **city-zones.json slug mismatch**: Mapped old slugs — updated all cities to use `aramex`, `marocolis`, `sendex`
- **Realtime payload camelCase bug**: `useTrackingEvents` hook cast `payload.new` directly to `TrackingEvent` — Supabase Realtime returns snake_case, causing `occurredAt` to be undefined → "Invalid Date". Fixed by manually mapping snake_case fields in the hook.

### Part 3 — Aramex Sandbox Integration Test ⏳
- Deferred to next session. Requires Aramex sandbox credentials from developer.aramex.com.

### Part 4 — Edge Cases ⏳
- Deferred to next session.

## Infrastructure Setup — 2026-03-15
- Supabase project: `wassalha` (hrxbzafwaldwqeiswzlu)
- DATABASE_URL switched from local PostgreSQL to Supabase pooler URL
- Migrations applied to Supabase (0000–0004)
- Supabase Realtime enabled for `shipments` and `tracking_events` via Database → Publications → supabase_realtime
- CRON_SECRET generated and saved to .env.local
- Users migrated from local DB to Supabase
- Carriers re-seeded with correct slugs
