# Phase 5 — Real-time Tracking Test Plan

**Date:** 2026-03-15
**Status:** Complete

---

## Before Anything — Pre-live Checklist

Complete these 3 steps before running any live or integration tests:

### 1. Apply DB Migration
```bash
pnpm db:migrate
```
Expected: migration `0004_sparkling_sharon_carter.sql` applied — `tracking_events` table created in Neon.

### 2. Enable Supabase Realtime
Go to [Supabase Dashboard](https://app.supabase.com) → your project → **Database → Replication**:
- Enable Realtime for `shipments`
- Enable Realtime for `tracking_events`

Without this, live badge updates and stepper inserts will not broadcast to the browser.

### 3. Set Environment Variables
Add to `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel Cron protection
CRON_SECRET=$(openssl rand -hex 32)

# Aramex Sandbox
ARAMEX_API_URL=https://ws.aramex.net/ShippingAPI.V2
ARAMEX_USERNAME=your_sandbox_username
ARAMEX_PASSWORD=your_sandbox_password
ARAMEX_ACCOUNT_NUMBER=your_sandbox_account_number
ARAMEX_ACCOUNT_PIN=your_sandbox_account_pin
```

---

## Part 1 — Automated Unit Tests

Run with:
```bash
pnpm test --run
```

### 1.1 Tracking Service (`src/lib/services/__tests__/tracking.test.ts`)

| # | Test | Expected |
|---|------|----------|
| 1 | `pollActiveShipments` — no active shipments | Returns `{ processed: 0, errors: 0 }` |
| 2 | `pollActiveShipments` — adapter throws | Counts error, does not throw, continues |
| 3 | `pollActiveShipments` — shipment without tracking number | Skips silently, `getAdapter` never called |
| 4 | `getTrackingEvents` — returns events | Returns array from DB |

### 1.2 Aramex Adapter (`src/lib/carriers/adapters/__tests__/aramex-tracking.test.ts`)

| # | Test | Expected |
|---|------|----------|
| 1 | No credentials set | Throws `CarrierApiError` with `code: "SERVICE_UNAVAILABLE"` |
| 2 | Carrier returns empty event list | Returns `[]` |
| 3 | Carrier returns events | Normalizes `SH005 → picked_up`, `SH006 → delivered`, populates `location` + `carrierRawStatus` |
| 4 | Carrier returns 401 | Throws `CarrierApiError` with `code: "AUTH_FAILED"` |

### 1.3 Pre-existing Suites (must remain green)

| Suite | Tests | Notes |
|-------|-------|-------|
| `carriers-validation.test.ts` | 21 | Zod schema validation |
| `carriers-api.test.ts` | 15 | API route handlers |
| `carriers-service.test.ts` | 12 | Carrier CRUD service |
| `comparison.test.ts` | 7 | Ranking algorithm |
| `commission.test.ts` | 5 | Dual-rate commission |
| `shipments.test.ts` | 11 | Booking Zod schemas |
| `types.test.ts` | 5 | CarrierApiError |
| `webhook.test.ts` | 6 | Clerk webhook handler |

**Expected total: 103+ passing.**

---

## Part 2 — Smoke Manual Test (Local Dev)

Start the dev server:
```bash
pnpm dev
```

### Step 1 — Shipments list loads with badges

1. Sign in and navigate to `/shipments`
2. Verify each row shows a colored status badge (not raw text like `"in_transit"`)
3. Verify a "Voir suivi" link appears in the last column of each row

**Pass criteria:** Badges render with correct colors (blue = confirmed, orange = in_transit, green = delivered, etc.)

---

### Step 2 — Shipment detail page loads

1. Click "Voir suivi" on any shipment row
2. Verify `/shipments/[id]` loads without error
3. Verify the page shows:
   - Shipment header with carrier tracking number
   - Status badge top-right
   - Shipment info card (carrier, recipient, origin, weight, COD)
   - Tracking History section with stepper

**Pass criteria:** Page loads, stepper renders 4 steps (Confirmed → Picked Up → In Transit → Delivered). Steps with no events show "—". Current status step shows animated spinner.

---

### Step 3 — Cron endpoint responds correctly

Test the cron endpoint manually:
```bash
curl -s -X GET http://localhost:3000/api/cron/tracking \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
```

Expected response:
```json
{ "ok": true, "processed": N, "errors": 0 }
```

Test unauthorized access:
```bash
curl -s -X GET http://localhost:3000/api/cron/tracking | jq
```

Expected response:
```json
{ "error": "Unauthorized" }
```
with HTTP 401.

**Pass criteria:** Authorized request returns `ok: true`. Unauthorized returns 401.

---

### Step 4 — Supabase Realtime badge update (simulate)

1. Open `/shipments` in the browser
2. In Supabase dashboard → Table Editor → `shipments`, manually update a shipment's `status` to `delivered`
3. Watch the badge in the browser — it should update live without page refresh

**Pass criteria:** Badge changes color and label within 1–2 seconds without any page reload.

---

### Step 5 — Stepper live update (simulate)

1. Open `/shipments/[id]` for a specific shipment
2. In Supabase dashboard → Table Editor → `tracking_events`, insert a new row:
   - `shipment_id`: the shipment UUID
   - `status`: `picked_up`
   - `carrier_raw_status`: `SH005`
   - `source`: `aramex`
   - `occurred_at`: now
3. Watch the stepper — the "Picked Up" step should activate live

**Pass criteria:** Stepper updates within 1–2 seconds showing the new event with timestamp.

---

## Part 3 — Aramex Sandbox Integration Test

### 3.1 Get Sandbox Credentials

1. Register at [developer.aramex.com](https://developer.aramex.com)
2. Create a new app → select **Shipping** + **Tracking** APIs
3. Copy the credentials into `.env.local`:
   - `ARAMEX_USERNAME`
   - `ARAMEX_PASSWORD`
   - `ARAMEX_ACCOUNT_NUMBER`
   - `ARAMEX_ACCOUNT_PIN`
4. Set `ARAMEX_API_URL=https://ws.aramex.net/ShippingAPI.V2`

> **Note:** Aramex sandbox uses the same base URL as production — credentials determine sandbox vs live. Sandbox credentials are issued per developer account.

---

### 3.2 Create a Sandbox Shipment (get a real tracking number)

Use the Wassalha UI to book a shipment:

1. Go to `/compare` → fill in origin/destination (e.g. Casablanca → Rabat, 1kg, COD 200 MAD)
2. Select **Aramex** from results → click **Book**
3. Complete the booking form → submit
4. Verify the shipment appears in `/shipments` with a tracking number like `12345678901`

**Or** call the API directly:
```bash
curl -s -X POST http://localhost:3000/api/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "carrierId": "ARAMEX_CARRIER_UUID",
    "shippingCostMad": 3500,
    "mode": "balanced",
    "originCity": "Casablanca",
    "recipientName": "Test Recipient",
    "recipientPhone": "+212600000000",
    "recipientCity": "Rabat",
    "recipientAddress": "123 Avenue Mohammed V",
    "weightG": 1000,
    "codAmountMad": 20000
  }' | jq
```

Copy the `carrierTrackingNumber` from the response.

---

### 3.3 Poll Tracking Manually

Trigger the cron manually to fetch the tracking status from Aramex:

```bash
curl -s -X GET http://localhost:3000/api/cron/tracking \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
```

Expected:
```json
{ "ok": true, "processed": 1, "errors": 0 }
```

---

### 3.4 Verify Events Were Written

Check the `tracking_events` table in Drizzle Studio:
```bash
pnpm db:studio
```

Go to `tracking_events` → filter by `shipment_id` → verify rows are present with:
- `source: "aramex"`
- `carrier_raw_status`: Aramex update code (e.g. `"SH001"`)
- `status`: normalized value (e.g. `"confirmed"`)
- `occurred_at`: timestamp from Aramex

---

### 3.5 Verify Shipment Status Updated

Check the `shipments` table → the `status` column should reflect the latest event.

---

### 3.6 Verify Live UI

1. Open `/shipments/[id]` for the Aramex shipment
2. Trigger the cron again (Step 3.3)
3. If a new event is written, the stepper should update live in the browser

> **Sandbox limitation:** Aramex sandbox does not simulate real parcel movement. Status updates in sandbox are usually limited to the initial booking confirmation state. To test status progression, manually insert rows into `tracking_events` via Supabase dashboard (as in Smoke Test Step 5) using valid Aramex status codes.

---

### 3.7 Aramex Status Code Reference (for manual testing)

| Aramex Code | Normalized Status | Label |
|-------------|------------------|-------|
| `SH005` | `picked_up` | Shipment Picked Up |
| `SH006` | `delivered` | Delivered |
| `SH009` | `failed` | Delivery Failed |
| `SH010` | `in_transit` | In Transit |
| `SH011` | `in_transit` | At Sorting Facility |
| `SH014` | `failed` | Return to Sender |

---

## Part 4 — Edge Cases to Verify Manually

| Scenario | How to test | Expected |
|----------|-------------|----------|
| Shipment older than 14 days | Update `created_at` in DB to 15 days ago, trigger cron | Not polled (`processed` count excludes it) |
| Shipment with status `delivered` | Trigger cron on a delivered shipment | Not polled (terminal status excluded) |
| Carrier API down (no env vars) | Remove `ARAMEX_API_URL`, trigger cron | `errors: 1`, other shipments still processed |
| Duplicate cron run | Trigger cron twice in a row | No duplicate `tracking_events` rows (upsert key prevents duplicates) |
| Unauthorized cron call | Call without `Authorization` header | HTTP 401 |
| Detail page for non-existent shipment | Navigate to `/shipments/invalid-uuid` | Next.js 404 page |
| Retailer accessing another user's shipment | Use retailer token to fetch another user's shipment ID | 404 (RBAC enforced in service layer) |

---

## Summary

| Layer | Tests | Status |
|-------|-------|--------|
| Unit — tracking service | 4 | ✅ automated |
| Unit — Aramex adapter tracking | 4 | ✅ automated |
| Smoke — UI rendering | 5 steps | Manual |
| Integration — Aramex sandbox | 7 steps | Manual (requires sandbox credentials) |
| Edge cases | 7 scenarios | Manual |
