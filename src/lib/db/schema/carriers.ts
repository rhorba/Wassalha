import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const carriers = pgTable("carriers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  reliabilityScore: integer("reliability_score").notNull().default(80),
  // 0–100, admin-set. Default 80 = neutral starting point.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const carrierZones = pgTable("carrier_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierId: uuid("carrier_id")
    .notNull()
    .references(() => carriers.id, { onDelete: "cascade" }),
  zoneName: text("zone_name").notNull(),
  zoneCode: text("zone_code").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const carrierPricing = pgTable("carrier_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => carrierZones.id, { onDelete: "restrict" }),
  weightMinG: integer("weight_min_g").notNull(),
  weightMaxG: integer("weight_max_g"), // null = no upper limit
  priceMad: integer("price_mad").notNull(), // centimes — 1500 = 15.00 MAD
  deliveryDaysMin: integer("delivery_days_min").notNull(),
  deliveryDaysMax: integer("delivery_days_max").notNull(),
  codFeeMad: integer("cod_fee_mad"),
  // flat COD surcharge in centimes, nullable
  codFeePercent: numeric("cod_fee_percent", { precision: 5, scale: 2 }),
  // percentage of COD amount, e.g. "1.50" = 1.5%, nullable
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Carrier = typeof carriers.$inferSelect;
export type NewCarrier = typeof carriers.$inferInsert;
export type CarrierZone = typeof carrierZones.$inferSelect;
export type NewCarrierZone = typeof carrierZones.$inferInsert;
export type CarrierPricing = typeof carrierPricing.$inferSelect;
export type NewCarrierPricing = typeof carrierPricing.$inferInsert;

export const carriersRelations = relations(carriers, ({ many }) => ({
  zones: many(carrierZones),
}));

export const carrierZonesRelations = relations(carrierZones, ({ one, many }) => ({
  carrier: one(carriers, { fields: [carrierZones.carrierId], references: [carriers.id] }),
  pricing: many(carrierPricing),
}));

export const carrierPricingRelations = relations(carrierPricing, ({ one }) => ({
  zone: one(carrierZones, { fields: [carrierPricing.zoneId], references: [carrierZones.id] }),
}));
