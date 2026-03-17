# Phase 4 — Test Plan

## Unit Tests

### 1. Commission Service
**File:** `src/lib/services/__tests__/commission.test.ts`
- `calculateCommission(1500, 10000)` → shippingFee=150, codFee=150, total=300
- `calculateCommission(0, 0)` → all zeros
- `calculateCommission(999, 1)` → rounds correctly (Math.round)
- Rates: 10% shipping, 1.5% COD

### 2. Carrier Adapter — `CarrierApiError`
**File:** `src/lib/carriers/__tests__/types.test.ts`
- `new CarrierApiError("AUTH_FAILED", "msg")` → `.name === "CarrierApiError"`, `.code === "AUTH_FAILED"`
- `instanceof Error` → true

### 3. Booking Input Zod Schema
**File:** `src/lib/validations/__tests__/shipments.test.ts`
- Valid input passes
- Missing `recipientName` → error
- Invalid phone (`"abc"`) → error
- `codAmountMad: -1` → error
- `carrierId: "not-uuid"` → error
- `recipientAddress` < 5 chars → error

## Integration Tests

### 4. `POST /api/shipments` — booking endpoint
**File:** `src/app/api/shipments/__tests__/route.test.ts`
- Unauthenticated → 401
- Invalid body → 400 with Zod error flatten
- Valid body + mocked `createBooking` success → 201 with `{ shipment, trackingNumber }`
- `createBooking` throws `CarrierApiError("SERVICE_UNAVAILABLE", ...)` → 502
- `createBooking` throws `Error("Carrier not found")` → 404

### 5. `GET /api/shipments` — list endpoint
**File:** `src/app/api/shipments/__tests__/route.test.ts`
- Unauthenticated → 401
- Authenticated retailer → 200 with `{ shipments, total, page, pageSize }`
- `page` and `pageSize` query params parsed correctly

## Service Tests

### 6. `listShipments` — pagination + RBAC
**File:** `src/lib/services/__tests__/bookings.test.ts`
- retailer role → only own shipments returned (where userId)
- admin role → no userId filter applied
- page/pageSize offset calculated correctly

---

## Manual Smoke Tests — Phase 4

Run against `pnpm dev` (localhost:3000). Mark ✅ pass or ❌ fail with notes.
Prerequisite: at least one carrier seeded (`pnpm db:migrate` + seed data present).

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| B1 | Booking sheet opens | Sign in → `/compare` → run comparison → click "Réserver" on a card | BookingSheet slides in from right with carrier name pre-filled |
| B2 | Booking form validation | Leave recipient name empty → click Submit | Inline error on required field. No network request. |
| B3 | Complete booking | Fill all fields (name, phone: `+212600000000`, address, weight, COD 500 MAD) → Submit | Success state or toast. Shipment created. |
| B4 | Shipment in dashboard | After B3, navigate to `/dashboard` | New shipment appears in recent shipments list |
| B5 | Shipment detail page | Click on the shipment row | `/shipments/[id]` loads with status badge + tracking timeline |
| B6 | Commission row created | After B3, open Drizzle Studio (`pnpm db:studio`) → commissions table | New row with shipping + COD commission amounts |
| B7 | Booking without email key | Remove `RESEND_API_KEY` from `.env.local` → complete a booking | Booking succeeds silently — no crash, no email sent |

> **B3 note:** With no real carrier API keys, the mock Aramex adapter is used. Set `ARAMEX_API_URL=http://localhost:3000/api/mock-aramex` in `.env.local`.
> **B5 note:** Requires Phase 5 tracking setup (Supabase) — if not configured, tracking timeline shows empty state.

