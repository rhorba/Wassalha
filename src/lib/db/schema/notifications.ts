import { pgEnum, pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { shipments } from "./shipments";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "whatsapp",
  "web_push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "failed",
]);

export const notifications = pgTable("notifications", {
  id:         uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  channel:    notificationChannelEnum("channel").notNull(),
  status:     notificationStatusEnum("status").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  shipment: one(shipments, { fields: [notifications.shipmentId], references: [shipments.id] }),
}));

export type Notification    = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
