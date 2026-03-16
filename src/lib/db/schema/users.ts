import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["retailer", "admin"]);

export const users = pgTable("users", {
  id:                   text("id").primaryKey(), // Clerk user ID e.g. user_2abc123
  email:                text("email").notNull().unique(),
  name:                 text("name"),
  role:                 roleEnum("role").notNull().default("retailer"),
  stripeCustomerId:     text("stripe_customer_id"),
  // Phase 7 — onboarding profile
  businessName:         text("business_name"),
  phone:                text("phone"),
  defaultSenderAddress: text("default_sender_address"),
  defaultSenderCity:    text("default_sender_city"),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
