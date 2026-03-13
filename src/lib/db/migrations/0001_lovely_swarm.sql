CREATE TABLE "carrier_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"weight_min_g" integer NOT NULL,
	"weight_max_g" integer,
	"price_mad" integer NOT NULL,
	"delivery_days_min" integer NOT NULL,
	"delivery_days_max" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"zone_name" text NOT NULL,
	"zone_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carriers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "carrier_pricing" ADD CONSTRAINT "carrier_pricing_zone_id_carrier_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."carrier_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_zones" ADD CONSTRAINT "carrier_zones_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;