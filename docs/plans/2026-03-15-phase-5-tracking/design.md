# Phase 5 — Real-time Tracking Design

**Date:** 2026-03-15
**Status:** Validated

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Update trigger | Hybrid — server-side cron (poll) + Aramex webhook ready in production |
| Tracking UI | Status badge on `/shipments` list + stepper timeline on `/shipments/[id]` |
| Map | None for MVP — stepper only (carriers expose city-level scans, not GPS) |
| Poll frequency | Every hour via Vercel Cron |
| Poll scope | Status: `confirmed \| picked_up \| in_transit` + created within last 14 days |
| Cron host | Vercel Cron → `GET /api/cron/tracking` |
| Event schema | Minimal + nullable `location` + `description` for forward compatibility |

---

## Section 1: Schema & Data Flow

### New table: `tracking_events`

```ts
export const tracking_events = pgTable("tracking_events", {
  id:               uuid("id").primaryKey().defaultRandom(),
  shipmentId:       uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  status:           shipmentStatusEnum("status").notNull(),
  carrierRawStatus: text("carrier_raw_status").notNull(),
  location:         text("location"),           // nullable — city/hub name if carrier provides
  description:      text("description"),        // nullable — human-readable event text
  source:           text("source").notNull(),   // carrier slug e.g. "aramex"
  occurredAt:       timestamp("occurred_at").notNull(),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});
```

Upsert key: `(shipmentId, occurredAt, carrierRawStatus)` — prevents duplicates on repeated polls.

### Data Flow

```
Vercel Cron (hourly)
  → GET /api/cron/tracking
    → trackingService.pollActiveShipments()
      → CarrierAdapter.getTrackingStatus(trackingNumber)
        → normalize response → upsert tracking_events
          → update shipments.status
            → Supabase Realtime broadcasts change
              → frontend updates badge + stepper
```

`shipments.status` is the source of truth. `tracking_events` is the audit log.

---

## Section 2: Carrier Adapter Extension

### New types

```ts
export interface TrackingEvent {
  carrierRawStatus: string;
  status:           ShipmentStatus;   // normalized to shipmentStatusEnum
  location?:        string;
  description?:     string;
  occurredAt:       Date;
}

export interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]>; // Phase 5
}
```

### Status normalization (Aramex example)

```ts
const STATUS_MAP: Record<string, ShipmentStatus> = {
  "SH005": "picked_up",
  "SH010": "in_transit",
  "SH006": "delivered",
  "SH012": "failed",
};
```

### Carriers without credentials

CTM, Amana, Marocolis, Sendex throw `CarrierApiError("SERVICE_UNAVAILABLE", ...)`.
Cron catches per-shipment — one failing carrier never blocks others.

---

## Section 3: Cron Handler & Tracking Service

### Route handler

```ts
// app/api/cron/tracking/route.ts
export async function GET(req: Request) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pollActiveShipments();
  return Response.json(result);
}
```

### vercel.json

```json
{
  "crons": [{ "path": "/api/cron/tracking", "schedule": "0 * * * *" }]
}
```

### Tracking service — `src/lib/services/tracking.ts`

```ts
export async function pollActiveShipments() {
  const shipments = await getActiveShipments();
  // filters: status IN (confirmed, picked_up, in_transit) AND createdAt > now - 14 days

  for (const shipment of shipments) {
    try {
      const adapter = getAdapter(shipment.carrierSlug);
      const events  = await adapter.getTrackingStatus(shipment.carrierTrackingNumber);
      await upsertTrackingEvents(shipment.id, events);
      await updateShipmentStatus(shipment.id, latestStatus(events));
    } catch (e) {
      // log + continue — never throws, never blocks other shipments
    }
  }
}
```

---

## Section 4: Frontend — Shipments List Badge

### Supabase Realtime hook

```ts
// hooks/use-shipment-status.ts
export function useShipmentStatus(shipmentId: string, initialStatus: ShipmentStatus) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const channel = supabase
      .channel(`shipment:${shipmentId}`)
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "shipments",
        filter: `id=eq.${shipmentId}`,
      }, (payload) => setStatus(payload.new.status))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shipmentId]);

  return status;
}
```

### Badge color map

| Status | Color |
|--------|-------|
| `pending` | gray |
| `confirmed` | blue |
| `picked_up` | yellow |
| `in_transit` | orange |
| `delivered` | green |
| `failed` | red |
| `cancelled` | gray |

Live updates without page refresh — no TanStack Query polling on list page.

---

## Section 5: Frontend — Shipment Detail Page & Stepper

### RSC + Client split

```ts
// app/(dashboard)/shipments/[id]/page.tsx  (RSC)
export default async function ShipmentDetailPage({ params }) {
  const shipment = await getShipmentById(params.id);
  const events   = await getTrackingEvents(params.id);
  return <TrackingTimeline shipment={shipment} initialEvents={events} />;
}
```

### TrackingTimeline (Client Component)

- Subscribes to `tracking_events` inserts via Supabase Realtime
- Prepends new events as they arrive
- Renders vertical stepper with shadcn/ui + Tailwind

### Stepper UI (mobile-first)

```
✅ Confirmed        Mar 15, 09:00
✅ Picked up        Mar 15, 14:30  — Casablanca
✅ In transit       Mar 16, 08:00  — Rabat Hub
⏳ Delivered        —
```

- Completed: green check icon
- Current: animated pulse dot
- Pending: gray empty circle
- `location` shown inline if carrier provides it
- `description` shown as subtext if available

---

## New Environment Variables

```bash
# Supabase Realtime
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel Cron protection
CRON_SECRET=your-random-secret
```

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/lib/db/schema/tracking.ts` | New — `tracking_events` table |
| `src/lib/db/schema/index.ts` | Update — export tracking schema |
| `src/lib/carriers/types.ts` | Update — add `TrackingEvent` + `getTrackingStatus` |
| `src/lib/carriers/adapters/aramex.ts` | Update — implement `getTrackingStatus` |
| `src/lib/carriers/adapters/ctm.ts` | Update — stub `getTrackingStatus` |
| `src/lib/carriers/adapters/amana.ts` | Update — stub `getTrackingStatus` |
| `src/lib/carriers/adapters/marocolis.ts` | Update — stub `getTrackingStatus` |
| `src/lib/carriers/adapters/sendex.ts` | Update — stub `getTrackingStatus` |
| `src/lib/services/tracking.ts` | New — `pollActiveShipments`, `upsertTrackingEvents` |
| `src/app/api/cron/tracking/route.ts` | New — Vercel Cron handler |
| `src/hooks/use-shipment-status.ts` | New — Supabase Realtime badge hook |
| `src/components/shipments/status-badge.tsx` | New — color-coded badge |
| `src/components/tracking/tracking-timeline.tsx` | New — stepper Client Component |
| `src/app/(dashboard)/shipments/[id]/page.tsx` | New — detail RSC |
| `vercel.json` | New — cron schedule |
| `drizzle migrations` | New — 0004 tracking_events |
