import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { carriers } from "./carriers";

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending",
  "confirmed",
  "picked_up",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
]);

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "invoiced",
  "paid",
]);

export const shipments = pgTable("shipments", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  userId:                text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  carrierId:             uuid("carrier_id").notNull().references(() => carriers.id, { onDelete: "restrict" }),
  status:                shipmentStatusEnum("status").notNull().default("pending"),
  recipientName:         text("recipient_name").notNull(),
  recipientPhone:        text("recipient_phone").notNull(),
  recipientCity:         text("recipient_city").notNull(),
  recipientAddress:      text("recipient_address").notNull(),
  originCity:            text("origin_city").notNull(),
  weightG:               integer("weight_g").notNull(),
  codAmountMad:          integer("cod_amount_mad").notNull(),       // centimes
  shippingCostMad:       integer("shipping_cost_mad").notNull(),    // centimes, from comparison
  parcelDescription:     text("parcel_description"),
  carrierTrackingNumber: text("carrier_tracking_number"),           // filled on carrier API success
  carrierReference:      text("carrier_reference"),
  mode:                  text("mode").notNull(),                    // cheapest | balanced | fastest
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
});

export const commissions = pgTable(
  "commissions",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    shipmentId:           uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "restrict" }),
    shippingFeePercent:   numeric("shipping_fee_percent", { precision: 5, scale: 2 }).notNull(),
    shippingFeeAmountMad: integer("shipping_fee_amount_mad").notNull(), // centimes
    codFeePercent:        numeric("cod_fee_percent", { precision: 5, scale: 2 }).notNull(),
    codFeeAmountMad:      integer("cod_fee_amount_mad").notNull(),       // centimes
    totalCommissionMad:   integer("total_commission_mad").notNull(),     // centimes
    status:               commissionStatusEnum("status").notNull().default("pending"),
    createdAt:            timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("commissions_shipment_id_unique").on(t.shipmentId)],
);

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  user:       one(users,     { fields: [shipments.userId],    references: [users.id] }),
  carrier:    one(carriers,  { fields: [shipments.carrierId], references: [carriers.id] }),
  commission: one(commissions, { fields: [shipments.id], references: [commissions.shipmentId] }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  shipment: one(shipments, { fields: [commissions.shipmentId], references: [shipments.id] }),
}));
