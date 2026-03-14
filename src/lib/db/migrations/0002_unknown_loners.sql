ALTER TABLE "carrier_pricing" ADD COLUMN "cod_fee_mad" integer;--> statement-breakpoint
ALTER TABLE "carrier_pricing" ADD COLUMN "cod_fee_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN "reliability_score" integer DEFAULT 80 NOT NULL;