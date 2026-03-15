# Phase 4 — Booking + Commission: Design

**Date:** 2026-03-15
**Status:** Validated
**Depends on:** Phase 3 (carrier comparison engine, 78 tests passing)

---

## Overview

Retailers select a carrier from comparison results, fill recipient + parcel details, and book in one click. Wassalha calls the carrier's API to create the shipment, records the booking + commission atomically, then sends a confirmation email to the retailer and a WhatsApp message to the recipient.

---

## Schema & Data Flow

### New Drizzle Tables

**`shipments`**
```
id                    uuid PK defaultRandom()
userId                text NOT NULL → users.id
carrierId             uuid NOT NULL → carriers.id
status                enum(pending | confirmed | picked_up | in_transit | delivered | failed | cancelled) NOT NULL default('pending')
recipientName         text NOT NULL
recipientPhone        text NOT NULL
recipientCity         text NOT NULL
recipientAddress      text NOT NULL
originCity            text NOT NULL
weightG               integer NOT NULL
codAmountMad          integer NOT NULL          -- centimes
shippingCostMad       integer NOT NULL          -- centimes, from comparison result
parcelDescription     text
carrierTrackingNumber text                      -- filled on carrier API success
carrierReference      text                      -- carrier internal reference
mode                  text NOT NULL             -- cheapest | balanced | fastest
createdAt             timestamp NOT NULL defaultNow()
updatedAt             timestamp NOT NULL defaultNow()
```

**`commissions`**
```
id                    uuid PK defaultRandom()
shipmentId            uuid NOT NULL UNIQUE → shipments.id
shippingFeePercent    numeric(5,2) NOT NULL     -- e.g. 10.00 = 10%
shippingFeeAmountMad  integer NOT NULL          -- centimes
codFeePercent         numeric(5,2) NOT NULL     -- e.g. 1.50 = 1.5%
codFeeAmountMad       integer NOT NULL          -- centimes
totalCommissionMad    integer NOT NULL          -- centimes
status                enum(pending | invoiced | paid) NOT NULL default('pending')
createdAt             timestamp NOT NULL defaultNow()
```

### Commission Calculation

Dual-rate model. Rates are typed config constants (no DB table at MVP scale):

```typescript
const COMMISSION_RATES = {
  shippingFeePercent: 10,   // 10% of carrier shipping cost
  codFeePercent: 1.5,       // 1.5% of COD amount collected
};

function calculateCommission(shippingCostMad: number, codAmountMad: number) {
  const shippingFee = Math.round(shippingCostMad * COMMISSION_RATES.shippingFeePercent / 100);
  const codFee      = Math.round(codAmountMad    * COMMISSION_RATES.codFeePercent      / 100);
  return {
    shippingFeePercent:   COMMISSION_RATES.shippingFeePercent,
    shippingFeeAmountMad: shippingFee,
    codFeePercent:        COMMISSION_RATES.codFeePercent,
    codFeeAmountMad:      codFee,
    totalCommissionMad:   shippingFee + codFee,
  };
}
```

### API Endpoints

```
POST /api/shipments       — create booking (carrier API + DB write + notifications)
GET  /api/shipments       — paginated list (retailer: own only; admin: all)
GET  /api/shipments/[id]  — single shipment detail
```

---

## Carrier Adapter Interface

**Location:** `src/lib/carriers/adapters/`

### Types (extend `src/lib/carriers/types.ts`)

```typescript
export interface CreateShipmentInput {
  recipientName: string;
  recipientPhone: string;
  recipientCity: string;
  recipientAddress: string;
  originCity: string;
  weightG: number;
  codAmountMad: number;        // centimes
  parcelDescription?: string;
}

export interface CarrierShipmentResult {
  trackingNumber: string;
  carrierReference?: string;
  labelUrl?: string;           // PDF waybill URL, if carrier provides
}

export interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  // getTrackingStatus() intentionally deferred to Phase 5
}

export class CarrierApiError extends Error {
  constructor(
    public code: "AUTH_FAILED" | "INVALID_ADDRESS" | "SERVICE_UNAVAILABLE" | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "CarrierApiError";
  }
}
```

### Adapters

One file per carrier, all implementing `CarrierAdapter`:

```
src/lib/carriers/adapters/
├── amana.ts
├── aramex.ts
├── ctm.ts
├── marocolis.ts
├── sendex.ts
└── index.ts       ← registry + getAdapter(slug)
```

### Registry

```typescript
// src/lib/carriers/adapters/index.ts
const adapters: Record<string, CarrierAdapter> = {
  amana:     new AmanaAdapter(),
  aramex:    new AramexAdapter(),
  ctm:       new CtmAdapter(),
  marocolis: new MarocolisAdapter(),
  sendex:    new SendexAdapter(),
};

export function getAdapter(slug: string): CarrierAdapter {
  const adapter = adapters[slug];
  if (!adapter) throw new Error(`No adapter for carrier: ${slug}`);
  return adapter;
}
```

Each adapter reads its credentials from env vars (e.g. `AMANA_API_KEY`, `ARAMEX_ACCOUNT_NUMBER`). Auth errors throw `CarrierApiError` with `code: "AUTH_FAILED"`.

---

## Booking Service

**Location:** `src/lib/services/bookings.ts`

```typescript
export async function createBooking(
  userId: string,
  input: BookingInput,
): Promise<{ shipment: Shipment; trackingNumber: string }> {

  // 1. Load carrier slug
  const carrier = await db.query.carriers.findFirst({
    where: eq(carriers.id, input.carrierId),
  });
  if (!carrier) throw new Error("Carrier not found");

  // 2. Call carrier adapter — throws CarrierApiError on failure
  const adapter = getAdapter(carrier.slug);
  const result  = await adapter.createShipment(input);

  // 3. Calculate commission
  const commission = calculateCommission(input.shippingCostMad, input.codAmountMad);

  // 4. Write shipment + commission atomically
  const shipment = await db.transaction(async (tx) => {
    const [s] = await tx.insert(shipments).values({
      userId,
      carrierId: input.carrierId,
      status: "confirmed",
      carrierTrackingNumber: result.trackingNumber,
      carrierReference: result.carrierReference,
      ...input,
    }).returning();

    await tx.insert(commissions).values({
      shipmentId: s.id,
      ...commission,
      status: "pending",
    });

    return s;
  });

  // 5. Fire-and-forget notifications (non-blocking — failures don't fail the booking)
  void sendBookingConfirmationEmail(userId, shipment, carrier);
  void sendRecipientWhatsApp(shipment);

  return { shipment, trackingNumber: result.trackingNumber };
}
```

### API Route (`POST /api/shipments`)

- Authenticate via Clerk
- Validate body with `BookingInputSchema` (Zod)
- Call `createBooking()`
- On `CarrierApiError`: return `502` with `{ error: { code, message } }`
- On success: return `201` with shipment + tracking number

---

## Frontend

### Component Tree

```
CompareResultsPage
└── CarrierResultCard          (one per ranked carrier)
    └── <Button> "Réserver"
        └── BookingSheet       (shadcn/ui Sheet — client component)
            └── BookingForm    (React Hook Form + Zod resolver)
                ├── recipientName        Input
                ├── recipientPhone       Input (+212 prefix)
                ├── recipientCity        Input (pre-filled, read-only)
                ├── recipientAddress     Textarea
                ├── codAmountMad         Input (pre-filled from compare)
                └── parcelDescription    Input (optional)
```

### TanStack Query Mutation

```typescript
// src/hooks/useCreateShipment.ts
export function useCreateShipment() {
  return useMutation({
    mutationFn: (input: BookingInput) =>
      fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["shipments"] }),
  });
}
```

### Success State (inside Sheet, replaces form)

```
✓ Réservation confirmée
Numéro de suivi: MA123456789  [Copier]
Transporteur: Amana  |  Livraison: 2–3 jours
Commission Wassalha: 18.50 MAD

[Voir tous mes envois →]
```

### Responsive Behaviour

- Mobile (`< sm`): Sheet opens full-screen
- Desktop (`sm:`): Sheet opens as side-panel (400px)

---

## Notifications

### Confirmation Email (Resend)

**Recipient:** retailer's email (from Clerk)
**Content:** carrier name, tracking number, recipient details, commission breakdown, estimated delivery

### WhatsApp Message (WhatsApp Business API)

**Recipient:** `recipientPhone`
**Content:** sender business name, tracking number, carrier name, estimated delivery, tracking link

Both are fire-and-forget — logged on failure but do not affect booking status.

---

## Error Handling Summary

| Scenario | HTTP | Response |
|----------|------|----------|
| Not authenticated | 401 | `{ error: "Unauthorized" }` |
| Invalid input | 400 | `{ error: flatten(zodError) }` |
| Carrier API failure | 502 | `{ error: { code, message } }` |
| Carrier not found | 404 | `{ error: "Carrier not found" }` |
| Success | 201 | `{ shipment, trackingNumber }` |
