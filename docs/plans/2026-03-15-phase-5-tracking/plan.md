# Phase 5 — Real-time Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Add hourly carrier polling, a `tracking_events` audit log, and live UI (status badge on list + stepper on detail page) powered by Supabase Realtime.

**Architecture:** A Vercel Cron job calls `GET /api/cron/tracking` hourly, which calls `pollActiveShipments()` in the service layer. Each active shipment's carrier adapter fetches the latest status, normalizes it, and upserts into `tracking_events`. Supabase Realtime then broadcasts the `shipments` UPDATE to the browser — no client-side polling needed.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W5 — Real-time Tracking

---

## Task 1: tracking_events DB Schema + Migration

**Files:**
- Create: `src/lib/db/schema/tracking.ts`
- Modify: `src/lib/db/schema/index.ts`

**Step 1: Create tracking schema**

```ts
// src/lib/db/schema/tracking.ts
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { shipments, shipmentStatusEnum } from "./shipments";

export const trackingEvents = pgTable(
  "tracking_events",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    shipmentId:       uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
    status:           shipmentStatusEnum("status").notNull(),
    carrierRawStatus: text("carrier_raw_status").notNull(),
    location:         text("location"),       // nullable — city/hub if carrier provides
    description:      text("description"),    // nullable — human-readable event text
    source:           text("source").notNull(), // carrier slug e.g. "aramex"
    occurredAt:       timestamp("occurred_at").notNull(),
    createdAt:        timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("tracking_events_upsert_key").on(t.shipmentId, t.occurredAt, t.carrierRawStatus),
  ],
);

export const trackingEventsRelations = relations(trackingEvents, ({ one }) => ({
  shipment: one(shipments, { fields: [trackingEvents.shipmentId], references: [shipments.id] }),
}));

export type TrackingEvent     = typeof trackingEvents.$inferSelect;
export type NewTrackingEvent  = typeof trackingEvents.$inferInsert;
```

**Step 2: Export from schema index**

```ts
// src/lib/db/schema/index.ts
export * from "./users";
export * from "./carriers";
export * from "./shipments";
export * from "./tracking";   // add this line
```

**Step 3: Also add the reverse relation on shipments**

In `src/lib/db/schema/shipments.ts`, add to `shipmentsRelations`:

```ts
// existing:
export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  user:           one(users,     { fields: [shipments.userId],    references: [users.id] }),
  carrier:        one(carriers,  { fields: [shipments.carrierId], references: [carriers.id] }),
  commission:     one(commissions, { fields: [shipments.id], references: [commissions.shipmentId] }),
  trackingEvents: many(trackingEvents),  // add this
}));
```

Note: You will need to import `trackingEvents` from `"./tracking"` at the top of `shipments.ts`. Because `shipments.ts` is imported by `tracking.ts`, use a lazy import pattern to avoid circular deps — import inside the relations callback:

```ts
// At top of shipments.ts, add:
import type { trackingEvents } from "./tracking";
```

Actually the cleanest approach: define `shipmentsToTrackingRelations` in `tracking.ts` itself (already done via `trackingEventsRelations`). Leave `shipments.ts` untouched — Drizzle resolves the relation from either side.

**Step 4: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file `0004_tracking_events.sql` created and applied.

---

## Task 2: Extend Carrier Types

**Files:**
- Modify: `src/lib/carriers/types.ts`

**Step 1: Add `TrackingEvent` interface and extend `CarrierAdapter`**

```ts
// src/lib/carriers/types.ts

import type { shipmentStatusEnum } from "@/lib/db/schema";

type ShipmentStatus = (typeof shipmentStatusEnum.enumValues)[number];

// Unified input for all carrier shipment creation calls
export interface CreateShipmentInput {
  recipientName:     string;
  recipientPhone:    string;
  recipientCity:     string;
  recipientAddress:  string;
  originCity:        string;
  weightG:           number;
  codAmountMad:      number;
  parcelDescription?: string;
}

// Normalized response from any carrier API
export interface CarrierShipmentResult {
  trackingNumber:    string;
  carrierReference?: string;
  labelUrl?:         string;
}

// Normalized tracking event from any carrier API
export interface TrackingEvent {
  carrierRawStatus: string;
  status:           ShipmentStatus;
  location?:        string;
  description?:     string;
  occurredAt:       Date;
}

// All carrier adapters implement this interface
export interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]>; // Phase 5
}

// Thrown by adapters on carrier API failure
export class CarrierApiError extends Error {
  constructor(
    public readonly code:
      | "AUTH_FAILED"
      | "INVALID_ADDRESS"
      | "SERVICE_UNAVAILABLE"
      | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "CarrierApiError";
  }
}
```

---

## Task 3: Aramex Adapter — Implement getTrackingStatus

**Files:**
- Modify: `src/lib/carriers/adapters/aramex.ts`

**Step 1: Add status map and implement method**

Aramex tracking API: `POST /v1/tracking/shipments/track` with `ClientInfo` + `Shipments: [{ ID: trackingNumber }]`.

```ts
// src/lib/carriers/adapters/aramex.ts
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult, TrackingEvent } from "../types";
import { CarrierApiError } from "../types";

// Map Aramex UpdateCode → our shipment status enum
const STATUS_MAP: Record<string, "confirmed" | "picked_up" | "in_transit" | "delivered" | "failed"> = {
  "SH005": "picked_up",
  "SH006": "delivered",
  "SH009": "failed",
  "SH010": "in_transit",
  "SH011": "in_transit",
  "SH014": "failed",
};

export class AramexAdapter implements CarrierAdapter {
  readonly slug = "aramex";

  private readonly baseUrl       = process.env.ARAMEX_API_URL       ?? "";
  private readonly username      = process.env.ARAMEX_USERNAME       ?? "";
  private readonly password      = process.env.ARAMEX_PASSWORD       ?? "";
  private readonly accountNumber = process.env.ARAMEX_ACCOUNT_NUMBER ?? "";
  private readonly accountPin    = process.env.ARAMEX_ACCOUNT_PIN    ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    // ... existing implementation unchanged
  }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]> {
    if (!this.baseUrl || !this.username) {
      throw new CarrierApiError("SERVICE_UNAVAILABLE", "Aramex: credentials not configured");
    }

    const res = await fetch(`${this.baseUrl}/v1/tracking/shipments/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ClientInfo: {
          UserName:      this.username,
          Password:      this.password,
          AccountNumber: this.accountNumber,
          AccountPin:    this.accountPin,
        },
        Shipments: [{ ID: trackingNumber }],
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Aramex: authentication failed");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Aramex: HTTP ${res.status}`);

    const data = (await res.json()) as {
      TrackingResults?: Array<{
        Value?: Array<{
          UpdateCode:        string;
          UpdateDescription: string;
          UpdateDateTime:    string;
          UpdateLocation?:   string;
        }>;
      }>;
      HasErrors: boolean;
    };

    if (data.HasErrors || !data.TrackingResults?.[0]?.Value) return [];

    return data.TrackingResults[0].Value.map((event) => ({
      carrierRawStatus: event.UpdateCode,
      status:           STATUS_MAP[event.UpdateCode] ?? "in_transit",
      location:         event.UpdateLocation ?? undefined,
      description:      event.UpdateDescription ?? undefined,
      occurredAt:       new Date(event.UpdateDateTime),
    }));
  }
}
```

---

## Task 4: Stub getTrackingStatus on Remaining Adapters

**Files:**
- Modify: `src/lib/carriers/adapters/amana.ts`
- Modify: `src/lib/carriers/adapters/ctm.ts`
- Modify: `src/lib/carriers/adapters/marocolis.ts`
- Modify: `src/lib/carriers/adapters/sendex.ts`

Add the same stub to each adapter. Example for Amana (repeat pattern for the other 3):

```ts
// Add import at top
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult, TrackingEvent } from "../types";

// Add method to class
async getTrackingStatus(_trackingNumber: string): Promise<TrackingEvent[]> {
  throw new CarrierApiError("SERVICE_UNAVAILABLE", "Amana: tracking API not yet integrated");
}
```

Replace `"Amana"` with `"CTM"`, `"Marocolis"`, `"Sendex"` in the respective files.

---

## Task 5: Tracking Service

**Files:**
- Create: `src/lib/services/tracking.ts`

**Step 1: Implement service**

```ts
// src/lib/services/tracking.ts
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, trackingEvents } from "@/lib/db/schema";
import { getAdapter } from "@/lib/carriers/adapters";
import type { TrackingEvent as AdapterEvent } from "@/lib/carriers/types";

const ACTIVE_STATUSES = ["confirmed", "picked_up", "in_transit"] as const;
const MAX_AGE_DAYS    = 14;

async function getActiveShipments() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  return db.query.shipments.findMany({
    where: and(
      inArray(shipments.status, [...ACTIVE_STATUSES]),
      gte(shipments.createdAt, cutoff),
    ),
    with: { carrier: true },
    columns: {
      id: true,
      carrierTrackingNumber: true,
      status: true,
    },
  });
}

async function upsertTrackingEvents(
  shipmentId: string,
  events: AdapterEvent[],
  source: string,
) {
  if (events.length === 0) return;

  await db
    .insert(trackingEvents)
    .values(
      events.map((e) => ({
        shipmentId,
        status:           e.status,
        carrierRawStatus: e.carrierRawStatus,
        location:         e.location,
        description:      e.description,
        source,
        occurredAt:       e.occurredAt,
      })),
    )
    .onConflictDoNothing(); // keyed on (shipmentId, occurredAt, carrierRawStatus)
}

function latestStatus(events: AdapterEvent[]) {
  const sorted = [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return sorted[0]?.status;
}

export async function pollActiveShipments(): Promise<{ processed: number; errors: number }> {
  const active = await getActiveShipments();
  let errors   = 0;

  for (const shipment of active) {
    if (!shipment.carrierTrackingNumber) continue;

    try {
      const adapter = getAdapter(shipment.carrier.slug);
      const events  = await adapter.getTrackingStatus(shipment.carrierTrackingNumber);

      await upsertTrackingEvents(shipment.id, events, shipment.carrier.slug);

      const next = latestStatus(events);
      if (next && next !== shipment.status) {
        await db
          .update(shipments)
          .set({ status: next, updatedAt: new Date() })
          .where(eq(shipments.id, shipment.id));
      }
    } catch (err) {
      console.error(`[tracking:poll] shipment=${shipment.id}`, err);
      errors++;
    }
  }

  return { processed: active.length, errors };
}

export async function getTrackingEvents(shipmentId: string) {
  return db.query.trackingEvents.findMany({
    where: eq(trackingEvents.shipmentId, shipmentId),
    orderBy: (t, { asc }) => [asc(t.occurredAt)],
  });
}
```

---

## Task 6: Cron Route Handler + vercel.json

**Files:**
- Create: `src/app/api/cron/tracking/route.ts`
- Create: `vercel.json`

**Step 1: Route handler**

```ts
// src/app/api/cron/tracking/route.ts
import { pollActiveShipments } from "@/lib/services/tracking";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollActiveShipments();
  return Response.json({ ok: true, ...result });
}
```

**Step 2: vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/tracking",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Step 3: Add CRON_SECRET to .env.example**

```bash
# Vercel Cron protection
CRON_SECRET=your-random-secret-min-32-chars
```

---

## Task 7: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

**Step 1: Install Supabase JS client**

```bash
pnpm add @supabase/supabase-js
```

**Step 2: Browser client (used in hooks)**

```ts
// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

**Step 3: Add env vars to .env.example**

```bash
# Supabase Realtime
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Step 4: Enable Realtime on the tables in Supabase dashboard**

Go to Supabase dashboard → Database → Replication → enable Realtime for:
- `shipments` (for status badge updates)
- `tracking_events` (for stepper live inserts)

---

## Task 8: useShipmentStatus Hook

**Files:**
- Create: `src/hooks/use-shipment-status.ts`

```ts
// src/hooks/use-shipment-status.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Shipment } from "@/lib/db/schema";

type ShipmentStatus = Shipment["status"];

export function useShipmentStatus(
  shipmentId: string,
  initialStatus: ShipmentStatus,
): ShipmentStatus {
  const [status, setStatus] = useState<ShipmentStatus>(initialStatus);

  useEffect(() => {
    const channel = supabase
      .channel(`shipment-status:${shipmentId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "shipments",
          filter: `id=eq.${shipmentId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: ShipmentStatus }).status;
          setStatus(newStatus);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [shipmentId]);

  return status;
}
```

---

## Task 9: useTrackingEvents Hook

**Files:**
- Create: `src/hooks/use-tracking-events.ts`

```ts
// src/hooks/use-tracking-events.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { TrackingEvent } from "@/lib/db/schema";

export function useTrackingEvents(
  shipmentId: string,
  initialEvents: TrackingEvent[],
): TrackingEvent[] {
  const [events, setEvents] = useState<TrackingEvent[]>(initialEvents);

  useEffect(() => {
    const channel = supabase
      .channel(`tracking-events:${shipmentId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "tracking_events",
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as TrackingEvent]);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [shipmentId]);

  // Keep sorted by occurredAt ascending
  return [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
```

---

## Task 10: StatusBadge Component

**Files:**
- Create: `src/components/shipments/status-badge.tsx`

```tsx
// src/components/shipments/status-badge.tsx
import { Badge } from "@/components/ui/badge";
import type { Shipment } from "@/lib/db/schema";

type ShipmentStatus = Shipment["status"];

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:    { label: "Pending",    variant: "secondary" },
  confirmed:  { label: "Confirmed",  variant: "default"   },
  picked_up:  { label: "Picked Up",  variant: "outline"   },
  in_transit: { label: "In Transit", variant: "default"   },
  delivered:  { label: "Delivered",  variant: "default"   },
  failed:     { label: "Failed",     variant: "destructive" },
  cancelled:  { label: "Cancelled",  variant: "secondary" },
};

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  pending:    "bg-gray-100 text-gray-700",
  confirmed:  "bg-blue-100 text-blue-700",
  picked_up:  "bg-yellow-100 text-yellow-700",
  in_transit: "bg-orange-100 text-orange-700",
  delivered:  "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
  cancelled:  "bg-gray-100 text-gray-500",
};

interface StatusBadgeProps {
  status: ShipmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {label}
    </span>
  );
}
```

---

## Task 11: TrackingTimeline Component

**Files:**
- Create: `src/components/tracking/tracking-timeline.tsx`

```tsx
// src/components/tracking/tracking-timeline.tsx
"use client";

import { useTrackingEvents } from "@/hooks/use-tracking-events";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { TrackingEvent, Shipment } from "@/lib/db/schema";

const ORDERED_STATUSES: Shipment["status"][] = [
  "confirmed",
  "picked_up",
  "in_transit",
  "delivered",
];

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("fr-MA", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

interface TrackingTimelineProps {
  shipment:      Pick<Shipment, "id" | "status">;
  initialEvents: TrackingEvent[];
}

export function TrackingTimeline({ shipment, initialEvents }: TrackingTimelineProps) {
  const events = useTrackingEvents(shipment.id, initialEvents);

  // Map status → latest event for that status
  const eventByStatus = new Map<string, TrackingEvent>();
  for (const e of events) {
    eventByStatus.set(e.status, e);
  }

  const currentIndex = ORDERED_STATUSES.indexOf(shipment.status as Shipment["status"]);

  return (
    <div className="flex flex-col gap-0">
      {ORDERED_STATUSES.map((status, index) => {
        const isDone    = index < currentIndex || (index === currentIndex && status === "delivered");
        const isCurrent = index === currentIndex && status !== "delivered";
        const event     = eventByStatus.get(status);

        return (
          <div key={status} className="flex gap-3">
            {/* Icon column */}
            <div className="flex flex-col items-center">
              <div className="mt-1">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              {index < ORDERED_STATUSES.length - 1 && (
                <div className={`mt-1 h-8 w-px ${isDone ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>

            {/* Content column */}
            <div className="pb-6">
              <p className={`text-sm font-medium capitalize ${isDone || isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                {status.replace("_", " ")}
              </p>
              {event ? (
                <>
                  <p className="text-xs text-gray-500">{formatDate(event.occurredAt)}</p>
                  {event.location    && <p className="text-xs text-gray-500">— {event.location}</p>}
                  {event.description && <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Task 12: Shipment Detail Page (RSC)

**Files:**
- Create: `src/app/(dashboard)/shipments/[id]/page.tsx`

```tsx
// src/app/(dashboard)/shipments/[id]/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getShipmentById } from "@/lib/services/bookings";
import { getTrackingEvents } from "@/lib/services/tracking";
import { TrackingTimeline } from "@/components/tracking/tracking-timeline";
import { StatusBadge } from "@/components/shipments/status-badge";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShipmentDetailPage({ params }: Props) {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const role    = (sessionClaims?.publicMetadata as { role?: string })?.role === "admin"
    ? "admin"
    : "retailer";

  const shipment = await getShipmentById(id, userId, role);
  if (!shipment) notFound();

  const events = await getTrackingEvents(id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shipment Details</h1>
          <p className="text-sm text-gray-500 font-mono">{shipment.carrierTrackingNumber}</p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      {/* Shipment info */}
      <div className="mb-8 rounded-lg border p-4 text-sm space-y-1">
        <p><span className="text-gray-500">Carrier:</span> {shipment.carrier.name}</p>
        <p><span className="text-gray-500">Recipient:</span> {shipment.recipientName} — {shipment.recipientCity}</p>
        <p><span className="text-gray-500">Origin:</span> {shipment.originCity}</p>
        <p><span className="text-gray-500">Weight:</span> {(shipment.weightG / 1000).toFixed(2)} kg</p>
        <p><span className="text-gray-500">COD:</span> {(shipment.codAmountMad / 100).toFixed(2)} MAD</p>
      </div>

      {/* Tracking timeline */}
      <h2 className="mb-4 text-base font-medium">Tracking History</h2>
      <TrackingTimeline
        shipment={{ id: shipment.id, status: shipment.status }}
        initialEvents={events}
      />
    </div>
  );
}
```

---

## Task 13: Wire StatusBadge into Shipments List

**Files:**
- Modify: `src/components/shipments/shipments-table.tsx`

**Step 1: Read the current shipments table**

Open `src/components/shipments/shipments-table.tsx` and find where `status` is currently rendered (likely a plain `<span>` or text).

**Step 2: Replace with live badge**

Replace the status cell with a client wrapper that uses `useShipmentStatus`:

```tsx
// In the status cell, replace raw text with:
import { StatusBadge } from "@/components/shipments/status-badge";
import { useShipmentStatus } from "@/hooks/use-shipment-status";

// Per-row client component:
function LiveStatusCell({ id, status }: { id: string; status: Shipment["status"] }) {
  const live = useShipmentStatus(id, status);
  return <StatusBadge status={live} />;
}
```

If `shipments-table.tsx` is already a Client Component (`"use client"`), add `LiveStatusCell` inline. If it's an RSC, extract only the status cell into a small Client Component file.

**Step 3: Add link to detail page**

In the shipments table row, wrap the tracking number or add an action column:

```tsx
import Link from "next/link";

// In row actions or tracking number cell:
<Link href={`/shipments/${shipment.id}`} className="text-blue-600 hover:underline text-xs">
  View tracking
</Link>
```

---

## Task 14: Tests

**Files:**
- Create: `src/lib/services/__tests__/tracking.test.ts`
- Create: `src/lib/carriers/adapters/__tests__/aramex-tracking.test.ts`

**Step 1: Tracking service unit tests**

```ts
// src/lib/services/__tests__/tracking.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db and adapters
vi.mock("@/lib/db", () => ({ db: { query: { shipments: { findMany: vi.fn() } }, update: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/carriers/adapters", () => ({ getAdapter: vi.fn() }));

import { pollActiveShipments } from "../tracking";
import { getAdapter } from "@/lib/carriers/adapters";

describe("pollActiveShipments", () => {
  it("returns processed count on success", async () => {
    // mock getActiveShipments returning empty → should return { processed: 0, errors: 0 }
    const result = await pollActiveShipments();
    expect(result.errors).toBe(0);
  });

  it("counts errors without throwing when adapter fails", async () => {
    vi.mocked(getAdapter).mockReturnValue({
      slug: "test",
      createShipment: vi.fn(),
      getTrackingStatus: vi.fn().mockRejectedValue(new Error("boom")),
    });
    // Should not throw
    await expect(pollActiveShipments()).resolves.toBeDefined();
  });
});
```

**Step 2: Aramex adapter tracking test**

```ts
// src/lib/carriers/adapters/__tests__/aramex-tracking.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AramexAdapter } from "../aramex";
import { CarrierApiError } from "../../types";

global.fetch = vi.fn();

describe("AramexAdapter.getTrackingStatus", () => {
  const adapter = new AramexAdapter();

  beforeEach(() => vi.clearAllMocks());

  it("throws SERVICE_UNAVAILABLE when credentials missing", async () => {
    await expect(adapter.getTrackingStatus("TRK123")).rejects.toThrow(CarrierApiError);
  });

  it("returns empty array when carrier returns no events", async () => {
    process.env.ARAMEX_API_URL  = "https://test.aramex.net";
    process.env.ARAMEX_USERNAME = "testuser";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ HasErrors: false, TrackingResults: [{ Value: [] }] }),
    } as Response);

    const events = await adapter.getTrackingStatus("TRK123");
    expect(events).toHaveLength(0);
  });
});
```

**Step 3: Run tests**

```bash
pnpm test
```

Expected: all 99 existing tests + new tracking tests pass.

---

## Task 15: Final Verification

**Step 1: Type check**

```bash
pnpm typecheck
```

Expected: zero type errors across all new + modified files.

**Step 2: Lint**

```bash
pnpm lint
```

Expected: zero lint errors.

**Step 3: Build**

```bash
pnpm build
```

Expected: build succeeds, no missing env var crashes (Supabase client uses `!` assertion — add fallback empty string if build fails).

**Step 4: Smoke test locally**

```bash
pnpm dev
```

- Visit `/shipments` → status badges render
- Click a shipment → `/shipments/[id]` shows stepper (empty tracking events is fine — polling hasn't run)
- Hit `GET /api/cron/tracking` with `Authorization: Bearer <CRON_SECRET>` header → returns `{ ok: true, processed: N, errors: 0 }`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(tracking): Phase 5 — real-time tracking via Vercel Cron + Supabase Realtime"
```

---

## Environment Variables Checklist

Add to `.env.local` before running:

```bash
# Supabase Realtime
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel Cron protection
CRON_SECRET=generate-with-openssl-rand-hex-32
```

Generate `CRON_SECRET`:
```bash
openssl rand -hex 32
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | `tracking_events` DB table + migration |
| 2 | `TrackingEvent` type + `getTrackingStatus` on `CarrierAdapter` |
| 3 | Aramex tracking implementation (sandbox-ready) |
| 4 | Stubs for Amana, CTM, Marocolis, Sendex |
| 5 | `pollActiveShipments` + `getTrackingEvents` service layer |
| 6 | Vercel Cron handler + `vercel.json` |
| 7 | Supabase JS client setup |
| 8 | `useShipmentStatus` Realtime hook |
| 9 | `useTrackingEvents` Realtime hook |
| 10 | `StatusBadge` component |
| 11 | `TrackingTimeline` stepper component |
| 12 | `/shipments/[id]` detail page (RSC) |
| 13 | Wire badge + detail link into shipments list |
| 14 | Unit tests |
| 15 | typecheck + lint + build + smoke test |
