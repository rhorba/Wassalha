import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, trackingEvents } from "@/lib/db/schema";
import { getAdapter } from "@/lib/carriers/adapters";
import type { TrackingEvent as AdapterEvent } from "@/lib/carriers/types";
import { sendWebPushToUser } from "@/lib/notifications/web-push";

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
      id:                    true,
      userId:                true,
      carrierTrackingNumber: true,
      status:                true,
    },
  });
}

async function upsertTrackingEvents(
  shipmentId: string,
  events:     AdapterEvent[],
  source:     string,
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

        void sendWebPushToUser(shipment.userId, shipment.id, {
          title: "Colis mis à jour",
          body:  `Votre envoi est maintenant : ${next.replace("_", " ")}`,
        });
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
    where:   eq(trackingEvents.shipmentId, shipmentId),
    orderBy: (t, { asc }) => [asc(t.occurredAt)],
  });
}
