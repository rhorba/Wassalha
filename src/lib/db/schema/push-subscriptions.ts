import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint:  text("endpoint").notNull(),
    p256dh:    text("p256dh").notNull(),
    auth:      text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("push_subscriptions_endpoint_unique").on(t.endpoint)],
);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));

export type PushSubscription    = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
