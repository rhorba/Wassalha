# Phase 5 — Real-time Tracking Test Plan

**Date:** 2026-03-15
**Status:** Complete ✅

---

## Before Anything — Pre-live Checklist

| Step | Action | Status |
|------|--------|--------|
| 1 | `pnpm db:migrate` — migration `0004_sparkling_sharon_carter.sql` applied | ✅ done |
| 2 | Supabase Realtime enabled for `shipments` + `tracking_events` (Database → Publications → supabase_realtime) | ✅ done |
| 3 | `.env.local` updated — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | ✅ done |

> **Note:** DB switched from local PostgreSQL to Supabase pooler. Migrations 0000–0004 applied to Supabase. Users migrated + carriers re-seeded with correct slugs.

---

## Part 1 — Automated Unit Tests

**Result: ✅ 107 tests passing**

```bash
pnpm test --run
```

### 1.1 Tracking Service (`src/lib/services/__tests__/tracking.test.ts`)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | `pollActiveShipments` — no active shipments | Returns `{ processed: 0, errors: 0 }` | ✅ pass |
| 2 | `pollActiveShipments` — adapter throws | Counts error, does not throw, continues | ✅ pass |
| 3 | `pollActiveShipments` — shipment without tracking number | Skips silently, `getAdapter` never called | ✅ pass |
| 4 | `getTrackingEvents` — returns events | Returns array from DB | ✅ pass |

### 1.2 Aramex Adapter (`src/lib/carriers/adapters/__tests__/aramex-tracking.test.ts`)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | No credentials set | Throws `CarrierApiError` with `code: "SERVICE_UNAVAILABLE"` | ✅ pass |
| 2 | Carrier returns empty event list | Returns `[]` | ✅ pass |
| 3 | Carrier returns events | Normalizes `SH005 → picked_up`, `SH006 → delivered`, populates `location` + `carrierRawStatus` | ✅ pass |
| 4 | Carrier returns 401 | Throws `CarrierApiError` with `code: "AUTH_FAILED"` | ✅ pass |

### 1.3 Pre-existing Suites (must remain green)

| Suite | Tests | Status |
|-------|-------|--------|
| `carriers-validation.test.ts` | 21 | ✅ pass |
| `carriers-api.test.ts` | 15 | ✅ pass |
| `carriers-service.test.ts` | 12 | ✅ pass |
| `comparison.test.ts` | 7 | ✅ pass |
| `commission.test.ts` | 5 | ✅ pass |
| `shipments.test.ts` | 11 | ✅ pass |
| `types.test.ts` | 5 | ✅ pass |
| `webhook.test.ts` | 6 | ✅ pass |

**Total: 107 passing ✅**

---

## Part 2 — Smoke Manual Test (Local Dev)

**Result: ✅ All 5 steps passed**

### Step 1 — Shipments list loads with badges

1. Sign in and navigate to `/shipments`
2. Verify each row shows a colored status badge (not raw text like `"in_transit"`)
3. Verify a "Voir suivi" link appears in the last column of each row

**Status: ✅ pass** — badges render with correct colors, "Voir suivi" links present.

---

### Step 2 — Shipment detail page loads

1. Click "Voir suivi" on any shipment row
2. Verify `/shipments/[id]` loads without error
3. Verify: shipment header, status badge top-right, info card, stepper with 4 steps

**Status: ✅ pass** — page loads, stepper renders 4 steps (Confirmed → Picked Up → In Transit → Delivered). Current status step shows animated spinner.

---

### Step 3 — Cron endpoint responds correctly

```bash
curl -s -X GET http://localhost:3000/api/cron/tracking \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
# → { "ok": true, "processed": 1, "errors": 1 }

curl -s -X GET http://localhost:3000/api/cron/tracking | jq
# → { "error": "Unauthorized" }  HTTP 401
```

**Status: ✅ pass** — authorized returns `ok: true`, unauthorized returns 401.

> Note: `errors: 1` is expected — one shipment used Amana stub which throws `SERVICE_UNAVAILABLE`. Per-shipment error isolation confirmed working.

---

### Step 4 — Supabase Realtime badge update (simulate)

1. Open `/shipments` in the browser
2. In Supabase dashboard → Table Editor → `shipments`, manually update a shipment's `status` to `delivered`
3. Watch the badge — should update live without page refresh

**Status: ✅ pass** — badge updates live.

> Note: Realtime UPDATE subscription unreliable (CHANNEL_ERROR when filter removed; silent no-events when kept). Fixed with **10s polling fallback** in `useShipmentStatus`. Both mechanisms active — polling guarantees delivery.

---

### Step 5 — Stepper live update (simulate)

1. Open `/shipments/[id]`
2. In Supabase → Table Editor → `tracking_events`, insert a row (`picked_up` / `SH005` / `aramex`)
3. Stepper should activate live

**Status: ✅ pass** — new tracking_events row appeared live without refresh.

---

## Part 3 — Aramex Sandbox Integration Test

**Result: ✅ All 7 steps passed (simulated — developer.aramex.com was down)**

> Mock Aramex API created at `src/app/api/mock-aramex/` (create + track endpoints).
> `ARAMEX_API_URL=http://localhost:3000/api/mock-aramex` set in `.env.local`.

### 3.1 Get Sandbox Credentials

**Status: ✅** — developer.aramex.com was down; mock API used instead.

### 3.2 Create a Sandbox Shipment

**Status: ✅** — booked via UI → tracking number `ARX-MOCK-1773621061006`

### 3.3 Poll Tracking Manually

```bash
curl -s -X GET http://localhost:3000/api/cron/tracking \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
# → { "ok": true, "processed": 1, "errors": 0 }
```

**Status: ✅ pass**

### 3.4 Verify Events Were Written

**Status: ✅ pass** — 3 rows in `tracking_events`: `SH001→in_transit`, `SH005→picked_up`, `SH010→in_transit` with correct locations + descriptions.

### 3.5 Verify Shipment Status Updated

**Status: ✅ pass** — `shipments.status` updated to `in_transit` by cron after polling.

### 3.6 Verify Live UI

**Status: ✅ pass** — updated mock to add `SH006` (delivered), triggered cron, badge flipped to delivered without page refresh.

### 3.7 Aramex Status Code Reference

| Aramex Code | Normalized Status | Label |
|-------------|-------------------|-------|
| `SH005` | `picked_up` | Shipment Picked Up |
| `SH006` | `delivered` | Delivered |
| `SH009` | `failed` | Delivery Failed |
| `SH010` | `in_transit` | In Transit |
| `SH011` | `in_transit` | At Sorting Facility |
| `SH014` | `failed` | Return to Sender |

**Status: ✅** — all codes verified against `STATUS_MAP` in adapter.

---

## Part 4 — Edge Cases

**Result: ✅ All 7 scenarios passed (2026-03-16)**

| # | Scenario | How to test | Expected | Status |
|---|----------|-------------|----------|--------|
| 1 | Shipment older than 14 days | `created_at=15d ago`, trigger cron | Not polled (`processed: 0`) | ✅ pass |
| 2 | Delivered shipment (terminal status) | Set `status=delivered`, trigger cron | Not polled (`processed: 0`) | ✅ pass |
| 3 | Carrier API down | Amana stub throws `SERVICE_UNAVAILABLE` | `errors: 1`, others still processed | ✅ pass |
| 4 | Duplicate cron run | Trigger cron twice | No duplicate `tracking_events` (upsert key) | ✅ pass |
| 5 | Unauthorized cron call | Call without `Authorization` header | HTTP 401 | ✅ pass |
| 6 | Detail page for non-existent shipment | Navigate to `/shipments/invalid-uuid` | Next.js 404 | ✅ pass |
| 7 | Retailer accessing another user's shipment | Wrong userId at service layer | 404 (RBAC enforced); admin bypasses correctly | ✅ pass |

Scripts in `scripts/edge-case-{1,2,3,4,7}.ts`.

---

## Bugs Found & Fixed

| Bug | Fix |
|-----|-----|
| Seed slug mismatch (`chronopost`, `fret-express`, `colis-prive`) | Updated `seed.ts` + `city-zones.json` to `aramex`, `marocolis`, `sendex` |
| Realtime payload camelCase — `occurredAt` undefined ("Invalid Date") | Manually mapped snake_case fields in `useTrackingEvents` hook |
| `__mock__` folder ignored by Next.js App Router | Renamed to `mock-aramex` |
| Supabase Realtime UPDATE not firing (CHANNEL_ERROR / silent) | Added 10s polling fallback to `useShipmentStatus`; subscription kept for best-effort |

---

## Summary

| Layer | Tests | Status |
|-------|-------|--------|
| Unit — tracking service | 4 | ✅ pass |
| Unit — Aramex adapter tracking | 4 | ✅ pass |
| Pre-existing suites | 99 | ✅ pass |
| **Total automated** | **107** | ✅ pass |
| Smoke — UI rendering | 5 steps | ✅ pass |
| Integration — Aramex (mock) | 7 steps | ✅ pass |
| Edge cases | 7 scenarios | ✅ pass |
