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

