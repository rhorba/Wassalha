# Phase 4 — Booking + Commission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Enable retailers to book a carrier directly from comparison results — calling the carrier's real API, recording the shipment + commission atomically, and sending a confirmation email + WhatsApp notification.

**Architecture:** Three new Drizzle tables (`shipments`, `commissions`, `shipment_status` enum) feed a booking service that orchestrates carrier adapter calls, DB transactions, and fire-and-forget notifications. The frontend wires a shadcn/ui Sheet into the existing `CarrierResultCard`, replacing the disabled "Book Now" button with a live booking flow.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W4 — Booking + Commission

---

## Batch 1 — Foundation: Schema + Validation + Adapter Types

### Task 1: Drizzle Schema — `shipments` + `commissions`

**Files:**
- Create: `src/lib/db/schema/shipments.ts`
- Modify: `src/lib/db/schema/index.ts`

**Step 1: Create `src/lib/db/schema/shipments.ts`**

```typescript
import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { carriers } from "./carriers";

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending",
  "confirmed",
  "picked_up",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
]);

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "invoiced",
  "paid",
]);

export const shipments = pgTable("shipments", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  userId:                text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  carrierId:             uuid("carrier_id").notNull().references(() => carriers.id, { onDelete: "restrict" }),
  status:                shipmentStatusEnum("status").notNull().default("pending"),
  recipientName:         text("recipient_name").notNull(),
  recipientPhone:        text("recipient_phone").notNull(),
  recipientCity:         text("recipient_city").notNull(),
  recipientAddress:      text("recipient_address").notNull(),
  originCity:            text("origin_city").notNull(),
  weightG:               integer("weight_g").notNull(),
  codAmountMad:          integer("cod_amount_mad").notNull(),       // centimes
  shippingCostMad:       integer("shipping_cost_mad").notNull(),    // centimes, from comparison
  parcelDescription:     text("parcel_description"),
  carrierTrackingNumber: text("carrier_tracking_number"),           // filled on carrier API success
  carrierReference:      text("carrier_reference"),
  mode:                  text("mode").notNull(),                    // cheapest | balanced | fastest
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
});

export const commissions = pgTable(
  "commissions",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    shipmentId:           uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "restrict" }),
    shippingFeePercent:   numeric("shipping_fee_percent", { precision: 5, scale: 2 }).notNull(),
    shippingFeeAmountMad: integer("shipping_fee_amount_mad").notNull(), // centimes
    codFeePercent:        numeric("cod_fee_percent", { precision: 5, scale: 2 }).notNull(),
    codFeeAmountMad:      integer("cod_fee_amount_mad").notNull(),       // centimes
    totalCommissionMad:   integer("total_commission_mad").notNull(),     // centimes
    status:               commissionStatusEnum("status").notNull().default("pending"),
    createdAt:            timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("commissions_shipment_id_unique").on(t.shipmentId)],
);

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  user:       one(users,     { fields: [shipments.userId],    references: [users.id] }),
  carrier:    one(carriers,  { fields: [shipments.carrierId], references: [carriers.id] }),
  commission: one(commissions, { fields: [shipments.id], references: [commissions.shipmentId] }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  shipment: one(shipments, { fields: [commissions.shipmentId], references: [shipments.id] }),
}));
```

**Step 2: Update `src/lib/db/schema/index.ts`**

Add export for the new file:
```typescript
export * from "./users";
export * from "./carriers";
export * from "./shipments";
```

**Step 3: Generate + apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: two new tables (`shipments`, `commissions`) and two new enums (`shipment_status`, `commission_status`) created in the DB.

---

### Task 2: Zod Validation Schemas for Booking

**Files:**
- Create: `src/lib/validations/shipments.ts`

**Step 1: Create `src/lib/validations/shipments.ts`**

```typescript
import { z } from "zod";

// Shared between API validation and frontend form
export const BookingInputSchema = z.object({
  carrierId:         z.string().uuid("Invalid carrier ID"),
  // Pre-filled from comparison result (centimes)
  shippingCostMad:   z.number().int().min(1, "Shipping cost required"),
  mode:              z.enum(["cheapest", "balanced", "fastest"]),
  // From original compare input
  originCity:        z.string().min(2, "Origin city required"),
  // Recipient details
  recipientName:     z.string().min(1, "Recipient name required").max(100),
  recipientPhone:    z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number"),
  recipientCity:     z.string().min(2, "Recipient city required"),
  recipientAddress:  z.string().min(5, "Full address required").max(300),
  // Package
  weightG:           z.number().int().min(1, "Weight must be at least 1g"),
  codAmountMad:      z.number().int().min(0, "COD amount must be >= 0"),
  parcelDescription: z.string().max(200).optional(),
});

export type BookingInput = z.infer<typeof BookingInputSchema>;

// Response shape from POST /api/shipments
export const ShipmentResponseSchema = z.object({
  id:                    z.string().uuid(),
  status:                z.string(),
  carrierTrackingNumber: z.string().nullable(),
  carrierId:             z.string().uuid(),
  recipientName:         z.string(),
  recipientCity:         z.string(),
  shippingCostMad:       z.number(),
  codAmountMad:          z.number(),
  createdAt:             z.string(),
});

export type ShipmentResponse = z.infer<typeof ShipmentResponseSchema>;

// Response shape from GET /api/shipments
export const ShipmentsListResponseSchema = z.object({
  shipments: z.array(ShipmentResponseSchema),
  total:     z.number(),
  page:      z.number(),
  pageSize:  z.number(),
});

export type ShipmentsListResponse = z.infer<typeof ShipmentsListResponseSchema>;
```

---

### Task 3: Carrier Adapter Types + `CarrierApiError`

**Files:**
- Create: `src/lib/carriers/types.ts`

**Step 1: Create `src/lib/carriers/types.ts`**

```typescript
// Unified input for all carrier shipment creation calls
export interface CreateShipmentInput {
  recipientName:     string;
  recipientPhone:    string;
  recipientCity:     string;
  recipientAddress:  string;
  originCity:        string;
  weightG:           number;
  codAmountMad:      number;       // centimes
  parcelDescription?: string;
}

// Normalized response from any carrier API
export interface CarrierShipmentResult {
  trackingNumber:    string;
  carrierReference?: string;
  labelUrl?:         string;       // PDF waybill URL, if carrier provides it
}

// All carrier adapters implement this interface
export interface CarrierAdapter {
  slug: string;
  createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult>;
  // getTrackingStatus() deferred to Phase 5
}

// Thrown by adapters on carrier API failure — caught by booking service
export class CarrierApiError extends Error {
  constructor(
    public readonly code:
      | "AUTH_FAILED"
      | "INVALID_ADDRESS"
      | "SERVICE_UNAVAILABLE"
      | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "CarrierApiError";
  }
}
```

---

## Batch 2 — Carrier Adapters + Commission + Notifications

### Task 4: Carrier Adapter Implementations (all 5) + Registry

**Files:**
- Create: `src/lib/carriers/adapters/amana.ts`
- Create: `src/lib/carriers/adapters/aramex.ts`
- Create: `src/lib/carriers/adapters/ctm.ts`
- Create: `src/lib/carriers/adapters/marocolis.ts`
- Create: `src/lib/carriers/adapters/sendex.ts`
- Create: `src/lib/carriers/adapters/index.ts`

**Step 1: Amana adapter — `src/lib/carriers/adapters/amana.ts`**

> Amana Maroc REST API. Credentials: `AMANA_API_URL`, `AMANA_API_KEY`, `AMANA_ACCOUNT_ID`.
> Docs: check carrier-specific API portal for exact endpoint + payload shape.

```typescript
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class AmanaAdapter implements CarrierAdapter {
  readonly slug = "amana";

  private readonly baseUrl  = process.env.AMANA_API_URL  ?? "";
  private readonly apiKey   = process.env.AMANA_API_KEY   ?? "";
  private readonly accountId = process.env.AMANA_ACCOUNT_ID ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        account_id:    this.accountId,
        recipient: {
          name:    input.recipientName,
          phone:   input.recipientPhone,
          city:    input.recipientCity,
          address: input.recipientAddress,
        },
        sender_city:   input.originCity,
        weight_g:      input.weightG,
        cod_amount:    input.codAmountMad,    // centimes
        description:   input.parcelDescription ?? "",
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Amana: authentication failed");
    if (res.status === 422) throw new CarrierApiError("INVALID_ADDRESS", "Amana: invalid address or city");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Amana: HTTP ${res.status}`);

    const data = (await res.json()) as { tracking_number: string; reference?: string; label_url?: string };
    return {
      trackingNumber:   data.tracking_number,
      carrierReference: data.reference,
      labelUrl:         data.label_url,
    };
  }
}
```

**Step 2: Aramex adapter — `src/lib/carriers/adapters/aramex.ts`**

> Aramex REST API (Morocco). Credentials: `ARAMEX_API_URL`, `ARAMEX_USERNAME`, `ARAMEX_PASSWORD`, `ARAMEX_ACCOUNT_NUMBER`, `ARAMEX_ACCOUNT_PIN`.

```typescript
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class AramexAdapter implements CarrierAdapter {
  readonly slug = "aramex";

  private readonly baseUrl  = process.env.ARAMEX_API_URL ?? "";
  private readonly username = process.env.ARAMEX_USERNAME ?? "";
  private readonly password = process.env.ARAMEX_PASSWORD ?? "";
  private readonly accountNumber = process.env.ARAMEX_ACCOUNT_NUMBER ?? "";
  private readonly accountPin    = process.env.ARAMEX_ACCOUNT_PIN    ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/v1/shipping/shipments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ClientInfo: {
          UserName:      this.username,
          Password:      this.password,
          AccountNumber: this.accountNumber,
          AccountPin:    this.accountPin,
        },
        Shipments: [{
          Consignee: {
            PartyName:    input.recipientName,
            PhoneNumber1: input.recipientPhone,
            City:         input.recipientCity,
            Line1:        input.recipientAddress,
            CountryCode:  "MA",
          },
          ShipmentDetails: {
            WeightUnit:        "G",
            Weight:            input.weightG,
            CashOnDeliveryAmount: { Value: input.codAmountMad / 100, CurrencyCode: "MAD" },
            DescriptionOfGoods: input.parcelDescription ?? "Merchandise",
          },
        }],
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Aramex: authentication failed");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Aramex: HTTP ${res.status}`);

    const data = (await res.json()) as {
      ProcessedShipment?: { ID: string; ForeignHAWB: string; LabelURL: string };
      HasErrors: boolean;
    };
    if (data.HasErrors || !data.ProcessedShipment) {
      throw new CarrierApiError("UNKNOWN", "Aramex: shipment creation failed");
    }
    return {
      trackingNumber:   data.ProcessedShipment.ID,
      carrierReference: data.ProcessedShipment.ForeignHAWB,
      labelUrl:         data.ProcessedShipment.LabelURL,
    };
  }
}
```

**Step 3: CTM adapter — `src/lib/carriers/adapters/ctm.ts`**

> CTM Messagerie API. Credentials: `CTM_API_URL`, `CTM_API_KEY`.

```typescript
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class CtmAdapter implements CarrierAdapter {
  readonly slug = "ctm";

  private readonly baseUrl = process.env.CTM_API_URL ?? "";
  private readonly apiKey  = process.env.CTM_API_KEY  ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/api/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify({
        destinataire: {
          nom:      input.recipientName,
          telephone: input.recipientPhone,
          ville:    input.recipientCity,
          adresse:  input.recipientAddress,
        },
        ville_expediteur: input.originCity,
        poids_g:          input.weightG,
        montant_cod:      input.codAmountMad,
        description:      input.parcelDescription ?? "",
      }),
    });

    if (res.status === 403) throw new CarrierApiError("AUTH_FAILED", "CTM: authentication failed");
    if (res.status === 400) throw new CarrierApiError("INVALID_ADDRESS", "CTM: invalid request data");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `CTM: HTTP ${res.status}`);

    const data = (await res.json()) as { numero_suivi: string; reference?: string };
    return {
      trackingNumber:   data.numero_suivi,
      carrierReference: data.reference,
    };
  }
}
```

**Step 4: Marocolis adapter — `src/lib/carriers/adapters/marocolis.ts`**

> Marocolis (Poste Maroc) API. Credentials: `MAROCOLIS_API_URL`, `MAROCOLIS_CLIENT_ID`, `MAROCOLIS_CLIENT_SECRET`.

```typescript
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class MarocolisAdapter implements CarrierAdapter {
  readonly slug = "marocolis";

  private readonly baseUrl      = process.env.MAROCOLIS_API_URL      ?? "";
  private readonly clientId     = process.env.MAROCOLIS_CLIENT_ID     ?? "";
  private readonly clientSecret = process.env.MAROCOLIS_CLIENT_SECRET ?? "";

  private async getToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) throw new CarrierApiError("AUTH_FAILED", "Marocolis: token request failed");
    const { access_token } = (await res.json()) as { access_token: string };
    return access_token;
  }

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const token = await this.getToken();

    const res = await fetch(`${this.baseUrl}/api/v1/colis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        destinataire_nom:       input.recipientName,
        destinataire_tel:       input.recipientPhone,
        destinataire_ville:     input.recipientCity,
        destinataire_adresse:   input.recipientAddress,
        expediteur_ville:       input.originCity,
        poids:                  input.weightG,
        valeur_cod:             input.codAmountMad,
        description:            input.parcelDescription ?? "",
      }),
    });

    if (!res.ok) throw new CarrierApiError("SERVICE_UNAVAILABLE", `Marocolis: HTTP ${res.status}`);

    const data = (await res.json()) as { code_suivi: string; id_colis?: string };
    return {
      trackingNumber:   data.code_suivi,
      carrierReference: data.id_colis,
    };
  }
}
```

**Step 5: Sendex adapter — `src/lib/carriers/adapters/sendex.ts`**

> Sendex API. Credentials: `SENDEX_API_URL`, `SENDEX_API_TOKEN`.

```typescript
import type { CarrierAdapter, CreateShipmentInput, CarrierShipmentResult } from "../types";
import { CarrierApiError } from "../types";

export class SendexAdapter implements CarrierAdapter {
  readonly slug = "sendex";

  private readonly baseUrl  = process.env.SENDEX_API_URL   ?? "";
  private readonly apiToken = process.env.SENDEX_API_TOKEN ?? "";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const res = await fetch(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${this.apiToken}`,
      },
      body: JSON.stringify({
        recipient_name:    input.recipientName,
        recipient_phone:   input.recipientPhone,
        recipient_city:    input.recipientCity,
        recipient_address: input.recipientAddress,
        sender_city:       input.originCity,
        weight_grams:      input.weightG,
        cod_amount_cents:  input.codAmountMad,
        notes:             input.parcelDescription ?? "",
      }),
    });

    if (res.status === 401) throw new CarrierApiError("AUTH_FAILED", "Sendex: authentication failed");
    if (res.status === 422) throw new CarrierApiError("INVALID_ADDRESS", "Sendex: invalid address");
    if (!res.ok)            throw new CarrierApiError("SERVICE_UNAVAILABLE", `Sendex: HTTP ${res.status}`);

    const data = (await res.json()) as { tracking_id: string; reference_number?: string; label?: string };
    return {
      trackingNumber:   data.tracking_id,
      carrierReference: data.reference_number,
      labelUrl:         data.label,
    };
  }
}
```

**Step 6: Adapter registry — `src/lib/carriers/adapters/index.ts`**

```typescript
import { AmanaAdapter }    from "./amana";
import { AramexAdapter }   from "./aramex";
import { CtmAdapter }      from "./ctm";
import { MarocolisAdapter } from "./marocolis";
import { SendexAdapter }   from "./sendex";
import type { CarrierAdapter } from "../types";

const adapters: Record<string, CarrierAdapter> = {
  amana:     new AmanaAdapter(),
  aramex:    new AramexAdapter(),
  ctm:       new CtmAdapter(),
  marocolis: new MarocolisAdapter(),
  sendex:    new SendexAdapter(),
};

export function getAdapter(slug: string): CarrierAdapter {
  const adapter = adapters[slug];
  if (!adapter) throw new Error(`No adapter registered for carrier slug: "${slug}"`);
  return adapter;
}
```

---

### Task 5: Commission Service

**Files:**
- Create: `src/lib/services/commission.ts`

**Step 1: Create `src/lib/services/commission.ts`**

```typescript
// Commission rates as typed constants — no DB table at MVP scale.
// Update these values to change rates globally.
const COMMISSION_RATES = {
  shippingFeePercent: 10,   // 10% of carrier shipping cost
  codFeePercent:      1.5,  // 1.5% of COD amount collected
} as const;

export interface CommissionBreakdown {
  shippingFeePercent:   number;
  shippingFeeAmountMad: number; // centimes
  codFeePercent:        number;
  codFeeAmountMad:      number; // centimes
  totalCommissionMad:   number; // centimes
}

/**
 * Calculate Wassalha commission for a shipment.
 * Both inputs are in centimes (integers).
 * Returns all amounts in centimes.
 */
export function calculateCommission(
  shippingCostMad: number,
  codAmountMad: number,
): CommissionBreakdown {
  const shippingFee = Math.round(
    (shippingCostMad * COMMISSION_RATES.shippingFeePercent) / 100,
  );
  const codFee = Math.round(
    (codAmountMad * COMMISSION_RATES.codFeePercent) / 100,
  );
  return {
    shippingFeePercent:   COMMISSION_RATES.shippingFeePercent,
    shippingFeeAmountMad: shippingFee,
    codFeePercent:        COMMISSION_RATES.codFeePercent,
    codFeeAmountMad:      codFee,
    totalCommissionMad:   shippingFee + codFee,
  };
}
```

---

### Task 6: Notification Helpers — Resend Email + WhatsApp

**Files:**
- Create: `src/lib/notifications/email.ts`
- Create: `src/lib/notifications/whatsapp.ts`

**Step 1: Install Resend SDK**

```bash
pnpm add resend
```

**Step 2: Create `src/lib/notifications/email.ts`**

```typescript
import { Resend } from "resend";
import type { Shipment, Carrier } from "@/lib/db/schema";
import type { CommissionBreakdown } from "@/lib/services/commission";

const resend = new Resend(process.env.RESEND_API_KEY);

interface BookingEmailParams {
  retailerEmail: string;
  retailerName:  string;
  shipment:      Shipment;
  carrier:       Carrier;
  commission:    CommissionBreakdown;
}

export async function sendBookingConfirmationEmail(
  params: BookingEmailParams,
): Promise<void> {
  const costMad       = (params.shipment.shippingCostMad / 100).toFixed(2);
  const commissionMad = (params.commission.totalCommissionMad / 100).toFixed(2);
  const codMad        = (params.shipment.codAmountMad / 100).toFixed(2);

  const { error } = await resend.emails.send({
    from:    "Wassalha <noreply@wassalha.ma>",
    to:      params.retailerEmail,
    subject: `Réservation confirmée — ${params.carrier.name} — ${params.shipment.carrierTrackingNumber ?? ""}`,
    html: `
      <h2>Réservation confirmée ✓</h2>
      <p>Bonjour ${params.retailerName},</p>
      <p>Votre envoi a été réservé avec succès.</p>
      <table>
        <tr><td><strong>Transporteur</strong></td><td>${params.carrier.name}</td></tr>
        <tr><td><strong>Numéro de suivi</strong></td><td>${params.shipment.carrierTrackingNumber ?? "—"}</td></tr>
        <tr><td><strong>Destinataire</strong></td><td>${params.shipment.recipientName} — ${params.shipment.recipientCity}</td></tr>
        <tr><td><strong>Montant COD</strong></td><td>${codMad} MAD</td></tr>
        <tr><td><strong>Frais de transport</strong></td><td>${costMad} MAD</td></tr>
        <tr><td><strong>Commission Wassalha</strong></td><td>${commissionMad} MAD</td></tr>
      </table>
      <p>Merci d'utiliser Wassalha.</p>
    `,
  });

  if (error) {
    console.error("[email] Failed to send booking confirmation:", error);
  }
}
```

**Step 3: Create `src/lib/notifications/whatsapp.ts`**

```typescript
interface WhatsAppShipmentParams {
  recipientPhone:        string;
  recipientName:         string;
  carrierName:           string;
  trackingNumber:        string;
  deliveryDaysMin?:      number;
  deliveryDaysMax?:      number;
  senderBusinessName:    string;
}

/**
 * Send a WhatsApp template message to the parcel recipient.
 * Uses WhatsApp Business Cloud API (Meta).
 * Credentials: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE_NAME.
 */
export async function sendRecipientWhatsApp(
  params: WhatsAppShipmentParams,
): Promise<void> {
  const phoneId      = process.env.WHATSAPP_PHONE_ID     ?? "";
  const token        = process.env.WHATSAPP_API_TOKEN    ?? "";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "shipment_notification";

  // Normalize phone: strip spaces, ensure +212 prefix for Morocco
  const phone = params.recipientPhone.replace(/\s/g, "");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:                phone,
        type:              "template",
        template: {
          name:     templateName,
          language: { code: "fr" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.recipientName },
                { type: "text", text: params.senderBusinessName },
                { type: "text", text: params.trackingNumber },
                { type: "text", text: params.carrierName },
              ],
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("[whatsapp] Failed to send notification:", err);
  }
}
```

---

## Batch 3 — Booking Service + API Routes + Hooks

### Task 7: Booking Service

**Files:**
- Create: `src/lib/services/bookings.ts`

**Step 1: Create `src/lib/services/bookings.ts`**

```typescript
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers, shipments, commissions } from "@/lib/db/schema";
import { getAdapter } from "@/lib/carriers/adapters";
import { CarrierApiError } from "@/lib/carriers/types";
import { calculateCommission } from "./commission";
import { sendBookingConfirmationEmail } from "@/lib/notifications/email";
import { sendRecipientWhatsApp } from "@/lib/notifications/whatsapp";
import { clerkClient } from "@clerk/nextjs/server";
import type { BookingInput } from "@/lib/validations/shipments";
import type { Shipment } from "@/lib/db/schema";

export { CarrierApiError };

export async function createBooking(
  userId: string,
  input: BookingInput,
): Promise<{ shipment: Shipment; trackingNumber: string }> {
  // 1. Load carrier to get slug
  const carrier = await db.query.carriers.findFirst({
    where: eq(carriers.id, input.carrierId),
  });
  if (!carrier) throw new Error("Carrier not found");

  // 2. Call carrier adapter — throws CarrierApiError on any failure
  const adapter = getAdapter(carrier.slug);
  const result  = await adapter.createShipment({
    recipientName:    input.recipientName,
    recipientPhone:   input.recipientPhone,
    recipientCity:    input.recipientCity,
    recipientAddress: input.recipientAddress,
    originCity:       input.originCity,
    weightG:          input.weightG,
    codAmountMad:     input.codAmountMad,
    parcelDescription: input.parcelDescription,
  });

  // 3. Calculate commission
  const commission = calculateCommission(input.shippingCostMad, input.codAmountMad);

  // 4. Write shipment + commission atomically
  const shipment = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(shipments)
      .values({
        userId,
        carrierId:             input.carrierId,
        status:                "confirmed",
        recipientName:         input.recipientName,
        recipientPhone:        input.recipientPhone,
        recipientCity:         input.recipientCity,
        recipientAddress:      input.recipientAddress,
        originCity:            input.originCity,
        weightG:               input.weightG,
        codAmountMad:          input.codAmountMad,
        shippingCostMad:       input.shippingCostMad,
        parcelDescription:     input.parcelDescription,
        mode:                  input.mode,
        carrierTrackingNumber: result.trackingNumber,
        carrierReference:      result.carrierReference,
      })
      .returning();

    await tx.insert(commissions).values({
      shipmentId:           s.id,
      shippingFeePercent:   commission.shippingFeePercent.toString(),
      shippingFeeAmountMad: commission.shippingFeeAmountMad,
      codFeePercent:        commission.codFeePercent.toString(),
      codFeeAmountMad:      commission.codFeeAmountMad,
      totalCommissionMad:   commission.totalCommissionMad,
      status:               "pending",
    });

    return s;
  });

  // 5. Fire-and-forget notifications — failures are logged, not thrown
  const clerk    = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId).catch(() => null);

  void sendBookingConfirmationEmail({
    retailerEmail: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
    retailerName:  clerkUser?.fullName ?? "Retailer",
    shipment,
    carrier,
    commission,
  });

  void sendRecipientWhatsApp({
    recipientPhone:     input.recipientPhone,
    recipientName:      input.recipientName,
    carrierName:        carrier.name,
    trackingNumber:     result.trackingNumber,
    senderBusinessName: clerkUser?.fullName ?? "Wassalha",
  });

  return { shipment, trackingNumber: result.trackingNumber };
}

export async function listShipments(
  userId: string,
  role: "retailer" | "admin",
  page: number,
  pageSize: number,
) {
  const offset = (page - 1) * pageSize;

  const rows = await db.query.shipments.findMany({
    where: role === "admin" ? undefined : eq(shipments.userId, userId),
    with:  { carrier: true, commission: true },
    limit:  pageSize,
    offset,
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  const total = await db.$count(
    shipments,
    role === "admin" ? undefined : eq(shipments.userId, userId),
  );

  return { shipments: rows, total, page, pageSize };
}

export async function getShipmentById(id: string, userId: string, role: "retailer" | "admin") {
  const shipment = await db.query.shipments.findFirst({
    where: eq(shipments.id, id),
    with:  { carrier: true, commission: true },
  });

  if (!shipment) return null;
  // Retailers can only see their own shipments
  if (role === "retailer" && shipment.userId !== userId) return null;

  return shipment;
}
```

---

### Task 8: API Routes — `POST /api/shipments`, `GET /api/shipments`, `GET /api/shipments/[id]`

**Files:**
- Create: `src/app/api/shipments/route.ts`
- Create: `src/app/api/shipments/[id]/route.ts`

**Step 1: Create `src/app/api/shipments/route.ts`**

```typescript
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { BookingInputSchema } from "@/lib/validations/shipments";
import { createBooking, listShipments, CarrierApiError } from "@/lib/services/bookings";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = BookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { shipment, trackingNumber } = await createBooking(userId, parsed.data);
    return NextResponse.json({ shipment, trackingNumber }, { status: 201 });
  } catch (err) {
    if (err instanceof CarrierApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 502 },
      );
    }
    if (err instanceof Error && err.message === "Carrier not found") {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }
    console.error("[POST /api/shipments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role === "admin"
    ? "admin"
    : "retailer";

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "20", 10));

  const result = await listShipments(userId, role, page, pageSize);
  return NextResponse.json(result);
}
```

**Step 2: Create `src/app/api/shipments/[id]/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getShipmentById } from "@/lib/services/bookings";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (sessionClaims?.metadata as { role?: string })?.role === "admin"
    ? "admin"
    : "retailer";

  const shipment = await getShipmentById(id, userId, role);
  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ shipment });
}
```

---

### Task 9: TanStack Query Hooks

**Files:**
- Create: `src/hooks/use-create-shipment.ts`
- Create: `src/hooks/use-shipments.ts`

**Step 1: Create `src/hooks/use-create-shipment.ts`**

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookingInput } from "@/lib/validations/shipments";

type CreateShipmentResponse = {
  shipment: { id: string; carrierTrackingNumber: string | null; shippingCostMad: number };
  trackingNumber: string;
};

type CarrierApiErrorResponse = {
  error: { code: string; message: string };
};

export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation<CreateShipmentResponse, CarrierApiErrorResponse, BookingInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/shipments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(input),
      });
      const data = (await res.json()) as CreateShipmentResponse | CarrierApiErrorResponse;
      if (!res.ok) throw data as CarrierApiErrorResponse;
      return data as CreateShipmentResponse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
  });
}
```

**Step 2: Create `src/hooks/use-shipments.ts`**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import type { ShipmentsListResponse } from "@/lib/validations/shipments";

export function useShipments(page = 1, pageSize = 20) {
  return useQuery<ShipmentsListResponse>({
    queryKey: ["shipments", page, pageSize],
    queryFn:  async () => {
      const res = await fetch(`/api/shipments?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch shipments");
      return res.json() as Promise<ShipmentsListResponse>;
    },
  });
}
```

---

## Batch 4 — Frontend: BookingForm + BookingSheet + Wire-up

### Task 10: Install shadcn/ui Sheet + Textarea

**Step 1: Add components**

```bash
pnpm dlx shadcn@latest add sheet
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add separator
```

**Step 2: Install React Hook Form + Zod resolver** (if not already installed)

```bash
pnpm add react-hook-form @hookform/resolvers
```

Verify in `package.json` that `react-hook-form` and `@hookform/resolvers` are present.

---

### Task 11: `BookingForm` + `BookingSheet` Components

**Files:**
- Create: `src/components/booking/booking-form.tsx`
- Create: `src/components/booking/booking-sheet.tsx`

**Step 1: Create `src/components/booking/booking-form.tsx`**

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookingInputSchema, type BookingInput } from "@/lib/validations/shipments";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

interface BookingFormProps {
  carrier:      CarrierResult;
  compareInput: CompareInput;
  onSubmit:     (data: BookingInput) => void;
  isPending:    boolean;
}

export function BookingForm({
  carrier,
  compareInput,
  onSubmit,
  isPending,
}: BookingFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(BookingInputSchema),
    defaultValues: {
      carrierId:       carrier.carrierId,
      shippingCostMad: carrier.totalCostMad,
      mode:            compareInput.mode,
      originCity:      compareInput.originCity,
      recipientCity:   compareInput.destinationCity,
      codAmountMad:    compareInput.codAmountMad,
      weightG:         compareInput.weightG,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      {/* Hidden fields */}
      <input type="hidden" {...register("carrierId")} />
      <input type="hidden" {...register("shippingCostMad", { valueAsNumber: true })} />
      <input type="hidden" {...register("mode")} />
      <input type="hidden" {...register("originCity")} />
      <input type="hidden" {...register("weightG", { valueAsNumber: true })} />
      <input type="hidden" {...register("codAmountMad", { valueAsNumber: true })} />

      {/* Recipient name */}
      <div className="space-y-1">
        <Label htmlFor="recipientName">Nom du destinataire</Label>
        <Input
          id="recipientName"
          placeholder="Mohammed Benali"
          {...register("recipientName")}
        />
        {errors.recipientName && (
          <p className="text-xs text-destructive">{errors.recipientName.message}</p>
        )}
      </div>

      {/* Recipient phone */}
      <div className="space-y-1">
        <Label htmlFor="recipientPhone">Téléphone</Label>
        <Input
          id="recipientPhone"
          placeholder="+212 6XX XXX XXX"
          type="tel"
          {...register("recipientPhone")}
        />
        {errors.recipientPhone && (
          <p className="text-xs text-destructive">{errors.recipientPhone.message}</p>
        )}
      </div>

      {/* Recipient city — read-only, pre-filled */}
      <div className="space-y-1">
        <Label htmlFor="recipientCity">Ville de destination</Label>
        <Input
          id="recipientCity"
          readOnly
          className="bg-muted cursor-not-allowed"
          {...register("recipientCity")}
        />
      </div>

      {/* Recipient address */}
      <div className="space-y-1">
        <Label htmlFor="recipientAddress">Adresse complète</Label>
        <Textarea
          id="recipientAddress"
          placeholder="12 Rue Ibn Battouta, Quartier Agdal"
          rows={3}
          {...register("recipientAddress")}
        />
        {errors.recipientAddress && (
          <p className="text-xs text-destructive">{errors.recipientAddress.message}</p>
        )}
      </div>

      {/* Parcel description (optional) */}
      <div className="space-y-1">
        <Label htmlFor="parcelDescription">
          Description du colis{" "}
          <span className="text-muted-foreground">(optionnel)</span>
        </Label>
        <Input
          id="parcelDescription"
          placeholder="Vêtements, électronique..."
          {...register("parcelDescription")}
        />
        {errors.parcelDescription && (
          <p className="text-xs text-destructive">{errors.parcelDescription.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Réservation en cours..." : "Confirmer la réservation"}
      </Button>
    </form>
  );
}
```

**Step 2: Create `src/components/booking/booking-sheet.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BookingForm } from "./booking-form";
import { useCreateShipment } from "@/hooks/use-create-shipment";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";
import type { BookingInput } from "@/lib/validations/shipments";
import Link from "next/link";

interface BookingSheetProps {
  carrier:      CarrierResult;
  compareInput: CompareInput;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

type SuccessState = {
  trackingNumber: string;
  carrierName:    string;
  deliveryMin:    number;
  deliveryMax:    number;
  commissionMad:  number; // centimes (approx, shown for transparency)
};

export function BookingSheet({
  carrier,
  compareInput,
  open,
  onOpenChange,
}: BookingSheetProps) {
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const createShipment = useCreateShipment();

  function handleSubmit(data: BookingInput) {
    createShipment.mutate(data, {
      onSuccess: (res) => {
        setSuccess({
          trackingNumber: res.trackingNumber,
          carrierName:    carrier.name,
          deliveryMin:    carrier.deliveryDaysMin,
          deliveryMax:    carrier.deliveryDaysMax,
          // Approximate commission shown to retailer (10% shipping + 1.5% COD)
          commissionMad:  Math.round(carrier.totalCostMad * 0.10) +
                          Math.round(compareInput.codAmountMad * 0.015),
        });
      },
    });
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) setSuccess(null); // reset success state when sheet closes
    onOpenChange(isOpen);
  }

  const errorMessage =
    createShipment.error &&
    typeof createShipment.error === "object" &&
    "error" in createShipment.error
      ? (createShipment.error as { error: { message: string } }).error.message
      : null;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      {/* Full-screen on mobile, side-panel on sm+ */}
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {success ? "Réservation confirmée ✓" : `Réserver avec ${carrier.name}`}
          </SheetTitle>
          {!success && (
            <SheetDescription>
              {(carrier.totalCostMad / 100).toFixed(2)} MAD ·{" "}
              {carrier.deliveryDaysMin === carrier.deliveryDaysMax
                ? `${carrier.deliveryDaysMin} jour(s)`
                : `${carrier.deliveryDaysMin}–${carrier.deliveryDaysMax} jours`}
            </SheetDescription>
          )}
        </SheetHeader>

        <Separator className="my-4" />

        {success ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Numéro de suivi</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{success.trackingNumber}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void navigator.clipboard.writeText(success.trackingNumber)}
                  >
                    Copier
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transporteur</span>
                <span>{success.carrierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Livraison estimée</span>
                <span>
                  {success.deliveryMin === success.deliveryMax
                    ? `${success.deliveryMin} jour(s)`
                    : `${success.deliveryMin}–${success.deliveryMax} jours`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission Wassalha</span>
                <span>{(success.commissionMad / 100).toFixed(2)} MAD</span>
              </div>
            </div>

            <Separator />

            <Button asChild className="w-full">
              <Link href="/shipments">Voir tous mes envois →</Link>
            </Button>
          </div>
        ) : (
          <>
            {errorMessage && (
              <p className="text-sm text-destructive mb-4">{errorMessage}</p>
            )}
            <BookingForm
              carrier={carrier}
              compareInput={compareInput}
              onSubmit={handleSubmit}
              isPending={createShipment.isPending}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

---

### Task 12: Update `CarrierResultCard` + `ResultsList` to Wire Up `BookingSheet`

**Files:**
- Modify: `src/components/compare/carrier-result-card.tsx`
- Modify: `src/components/compare/results-list.tsx`
- Modify: `src/app/(dashboard)/compare/compare-page-client.tsx`

**Step 1: Update `src/components/compare/carrier-result-card.tsx`**

Replace the disabled `<Button asChild>` + `<Link>` with a live button that opens the `BookingSheet`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingSheet } from "@/components/booking/booking-sheet";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

interface CarrierResultCardProps {
  result:       CarrierResult;
  isTop:        boolean;
  compareInput: CompareInput;
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round((score / 100) * 5);
  return (
    <span className="text-sm text-muted-foreground" aria-label={`${stars} out of 5 stars`}>
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}
    </span>
  );
}

export function CarrierResultCard({ result, isTop, compareInput }: CarrierResultCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const costMad = (result.totalCostMad / 100).toFixed(2);

  return (
    <>
      <Card className="relative">
        {isTop && (
          <Badge className="absolute top-3 right-3" variant="default">
            Best Match
          </Badge>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {result.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.logoUrl}
                alt={result.name}
                className="h-8 w-auto object-contain"
              />
            )}
            <h3 className="font-semibold text-lg">{result.name}</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{costMad} MAD</span>
            <StarRating score={result.reliabilityScore} />
          </div>
          <p className="text-sm text-muted-foreground">
            {result.deliveryDaysMin === result.deliveryDaysMax
              ? `${result.deliveryDaysMin} day${result.deliveryDaysMin > 1 ? "s" : ""}`
              : `${result.deliveryDaysMin}–${result.deliveryDaysMax} days`}
          </p>
          {result.codFeeBreakdown.total > 0 && (
            <p className="text-xs text-muted-foreground">
              COD fee: {(result.codFeeBreakdown.total / 100).toFixed(2)} MAD
            </p>
          )}
          <Button
            variant="default"
            className="w-full"
            onClick={() => setSheetOpen(true)}
          >
            Réserver →
          </Button>
        </CardContent>
      </Card>

      <BookingSheet
        carrier={result}
        compareInput={compareInput}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
```

**Step 2: Update `src/components/compare/results-list.tsx`**

Add `compareInput` prop and thread it to `CarrierResultCard`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CarrierResultCard } from "@/components/compare/carrier-result-card";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

type SortKey = "score" | "totalCostMad" | "deliveryDaysMin";

interface ResultsListProps {
  results:      CarrierResult[];
  compareInput: CompareInput;
}

export function ResultsList({ results, compareInput }: ResultsListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No carriers available for this route and weight.
      </p>
    );
  }

  const sorted = [...results].sort((a, b) => {
    if (sortKey === "score")           return b.score - a.score;
    if (sortKey === "totalCostMad")    return a.totalCostMad - b.totalCostMad;
    if (sortKey === "deliveryDaysMin") return a.deliveryDaysMin - b.deliveryDaysMin;
    return 0;
  });

  const sortLabels: Record<SortKey, string> = {
    score:           "Score",
    totalCostMad:    "Price",
    deliveryDaysMin: "Speed",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={sortKey === key ? "default" : "outline"}
            onClick={() => setSortKey(key)}
          >
            {sortLabels[key]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((result, i) => (
          <CarrierResultCard
            key={result.carrierId}
            result={result}
            isTop={i === 0}
            compareInput={compareInput}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Update `src/app/(dashboard)/compare/compare-page-client.tsx`**

Thread `compareInput` through to `ResultsList`:

```tsx
"use client";

import { useState } from "react";
import { CompareForm } from "@/components/compare/compare-form";
import { ResultsList } from "@/components/compare/results-list";
import { useCompare } from "@/hooks/use-compare";
import type { CarrierResult, CompareInput } from "@/lib/validations/carriers";

export function ComparePageClient() {
  const [results, setResults]           = useState<CarrierResult[] | null>(null);
  const [cityNotFound, setCityNotFound] = useState(false);
  const [lastInput, setLastInput]       = useState<CompareInput | null>(null);
  const compare = useCompare();

  return (
    <div className="space-y-8">
      <CompareForm
        isLoading={compare.isPending}
        onSubmit={(data) => {
          setCityNotFound(false);
          setLastInput(data);
          compare.mutate(data, {
            onSuccess: (res) => {
              setResults(res.results);
              setCityNotFound(res.cityNotFound ?? false);
            },
          });
        }}
      />

      {compare.isError && (
        <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
      )}

      {cityNotFound && (
        <p className="text-sm text-muted-foreground">
          Destination city not recognized — please select a city from the autocomplete dropdown.
        </p>
      )}

      {results !== null && !cityNotFound && lastInput && (
        <ResultsList results={results} compareInput={lastInput} />
      )}
    </div>
  );
}
```

---

## Batch 5 — Shipments Page + Env Vars + Verification

### Task 13: Shipments List Page

**Files:**
- Create: `src/app/(dashboard)/shipments/page.tsx`
- Create: `src/components/shipments/shipments-table.tsx`

**Step 1: Create `src/components/shipments/shipments-table.tsx`**

```tsx
"use client";

import { useShipments } from "@/hooks/use-shipments";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending:    "secondary",
  confirmed:  "default",
  picked_up:  "default",
  in_transit: "default",
  delivered:  "outline",
  failed:     "destructive",
  cancelled:  "destructive",
};

export function ShipmentsTable() {
  const { data, isLoading, isError } = useShipments();

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError)   return <p className="text-sm text-destructive">Erreur de chargement.</p>;
  if (!data || data.shipments.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun envoi pour le moment.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destinataire</TableHead>
          <TableHead>Ville</TableHead>
          <TableHead>Transporteur</TableHead>
          <TableHead>Suivi</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Coût (MAD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.shipments.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.recipientName}</TableCell>
            <TableCell>{s.recipientCity}</TableCell>
            <TableCell>{s.carrierId}</TableCell>
            <TableCell className="font-mono text-xs">
              {s.carrierTrackingNumber ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                {s.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {(s.shippingCostMad / 100).toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 2: Create `src/app/(dashboard)/shipments/page.tsx`**

```tsx
import { ShipmentsTable } from "@/components/shipments/shipments-table";

export default function ShipmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes envois</h1>
        <p className="text-muted-foreground text-sm">
          Historique de toutes vos réservations.
        </p>
      </div>
      <ShipmentsTable />
    </div>
  );
}
```

---

### Task 14: Update `.env.example` with New Variables

**Files:**
- Modify: `.env.example`

Add the following block under the existing env vars:

```bash
# ── Carrier APIs ──────────────────────────────────────────────────────────────

# Amana Maroc
AMANA_API_URL=https://api.amana.ma
AMANA_API_KEY=
AMANA_ACCOUNT_ID=

# Aramex
ARAMEX_API_URL=https://ws.aramex.net/ShippingAPI.V2
ARAMEX_USERNAME=
ARAMEX_PASSWORD=
ARAMEX_ACCOUNT_NUMBER=
ARAMEX_ACCOUNT_PIN=

# CTM Messagerie
CTM_API_URL=https://api.ctm.ma
CTM_API_KEY=

# Marocolis (Poste Maroc)
MAROCOLIS_API_URL=https://api.marocolis.ma
MAROCOLIS_CLIENT_ID=
MAROCOLIS_CLIENT_SECRET=

# Sendex
SENDEX_API_URL=https://api.sendex.ma
SENDEX_API_TOKEN=

# ── Notifications ─────────────────────────────────────────────────────────────

# Resend (transactional email)
RESEND_API_KEY=re_...

# WhatsApp Business Cloud API (Meta)
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_TEMPLATE_NAME=shipment_notification
```

---

### Task 15: Full Verification

**Step 1: Typecheck**

```bash
pnpm typecheck
```

Expected: zero TypeScript errors.

**Step 2: Lint**

```bash
pnpm lint
```

Expected: zero ESLint errors or warnings.

**Step 3: Build**

```bash
pnpm build
```

Expected: successful production build with no errors.

**Step 4: Manual smoke test (dev server)**

```bash
pnpm dev
```

1. Navigate to `/compare`
2. Run a comparison (e.g. Casablanca → Marrakech, 500g, balanced)
3. Click "Réserver →" on any result card
4. Verify Sheet opens with pre-filled city + COD amount
5. Fill recipient details and submit
6. Verify success state shows tracking number + "Copier" button
7. Navigate to `/shipments` — verify shipment appears in table

**Step 5: Commit**

```bash
git add src/lib/db/schema/shipments.ts \
        src/lib/db/schema/index.ts \
        src/lib/validations/shipments.ts \
        src/lib/carriers/types.ts \
        src/lib/carriers/adapters/ \
        src/lib/services/bookings.ts \
        src/lib/services/commission.ts \
        src/lib/notifications/ \
        src/app/api/shipments/ \
        src/hooks/use-create-shipment.ts \
        src/hooks/use-shipments.ts \
        src/components/booking/ \
        src/components/shipments/ \
        src/components/compare/carrier-result-card.tsx \
        src/components/compare/results-list.tsx \
        src/app/\(dashboard\)/compare/compare-page-client.tsx \
        src/app/\(dashboard\)/shipments/ \
        .env.example

git commit -m "feat: Phase 4 — one-click booking, carrier adapters, commission engine, notifications"
```

---

## Summary

| Task | Area | Key Output |
|------|------|------------|
| 1 | DB | `shipments` + `commissions` tables + migration |
| 2 | Validation | `BookingInputSchema` (shared API + frontend) |
| 3 | Carriers | `CarrierAdapter` interface + `CarrierApiError` |
| 4 | Carriers | 5 adapter implementations + registry |
| 5 | Service | `calculateCommission()` — dual-rate model |
| 6 | Notifications | Resend email + WhatsApp fire-and-forget |
| 7 | Service | `createBooking()` — orchestrates all above |
| 8 | API | `POST/GET /api/shipments`, `GET /api/shipments/[id]` |
| 9 | Hooks | `useCreateShipment`, `useShipments` |
| 10 | UI | shadcn/ui Sheet + Textarea installed |
| 11 | UI | `BookingForm` + `BookingSheet` components |
| 12 | UI | `CarrierResultCard` + `ResultsList` + `ComparePageClient` wired up |
| 13 | UI | `/shipments` page + `ShipmentsTable` |
| 14 | Config | `.env.example` updated with all carrier + notification vars |
| 15 | QA | typecheck + lint + build + smoke test + commit |
