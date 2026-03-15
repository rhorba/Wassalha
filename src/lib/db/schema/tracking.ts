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
    location:         text("location"),        // nullable — city/hub if carrier provides
    description:      text("description"),     // nullable — human-readable event text
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

export type TrackingEvent    = typeof trackingEvents.$inferSelect;
export type NewTrackingEvent = typeof trackingEvents.$inferInsert;
