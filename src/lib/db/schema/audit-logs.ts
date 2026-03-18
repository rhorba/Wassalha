import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  actorId:    text("actor_id").notNull(),    // Clerk user ID
  actorRole:  text("actor_role").notNull(),   // "admin" | "retailer"
  action:     text("action").notNull(),       // e.g. "carrier.create"
  targetType: text("target_type").notNull(), // "carrier" | "invoice" | "user" | "shipment"
  targetId:   text("target_id").notNull(),   // UUID or Clerk user ID string
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog    = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
