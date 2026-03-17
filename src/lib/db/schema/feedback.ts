import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  message: text('message').notNull(),
  page: text('page').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
