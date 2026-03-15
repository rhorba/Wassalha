CREATE TYPE "public"."commission_status" AS ENUM('pending', 'invoiced', 'paid');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'confirmed', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"shipping_fee_percent" numeric(5, 2) NOT NULL,
	"shipping_fee_amount_mad" integer NOT NULL,
	"cod_fee_percent" numeric(5, 2) NOT NULL,
	"cod_fee_amount_mad" integer NOT NULL,
	"total_commission_mad" integer NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_shipment_id_unique" UNIQUE("shipment_id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"carrier_id" uuid NOT NULL,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_city" text NOT NULL,
	"recipient_address" text NOT NULL,
	"origin_city" text NOT NULL,
	"weight_g" integer NOT NULL,
	"cod_amount_mad" integer NOT NULL,
	"shipping_cost_mad" integer NOT NULL,
	"parcel_description" text,
	"carrier_tracking_number" text,
	"carrier_reference" text,
	"mode" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE restrict ON UPDATE no action;