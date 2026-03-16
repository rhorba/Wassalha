ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "stripe_invoice_id" text;