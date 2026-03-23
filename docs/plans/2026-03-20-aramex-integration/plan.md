# Aramex Real API Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Replace the JSON mock Aramex adapter with a real SOAP client that calls the official Aramex staging/production endpoints for shipment creation, tracking, live rate calculation (in the compare engine), and on-demand label printing.

**Architecture:** Raw XML SOAP envelopes sent via `fetch` + `fast-xml-parser` for response parsing. The `AramexAdapter` is fully rewritten to speak SOAP while preserving the `CarrierAdapter` interface. The comparison engine gets a hybrid pricing model: Aramex rates fetched live via `CalculateRate` (3s timeout, graceful exclusion on failure), all other carriers stay on static DB pricing. A new `GET /api/shipments/[id]/label` route calls `PrintLabel` SOAP on demand and returns a 302 redirect — no label storage needed.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W10 — Aramex Real API Integration

---

## Design Decisions

| Decision | Choice |
|---|---|
| SOAP client | Raw XML + `fast-xml-parser` |
| CalculateRate | Live in compare, 3s timeout, graceful exclusion |
| Mock strategy | Delete mock routes, use Aramex official staging |
| CreatePickup | Skip — standing pickup agreement |
| Label storage | PrintLabel on-demand, 302 redirect |
| Status codes | Full ~30-code mapping |

---

## Files Overview

**Delete:**
- `src/app/api/mock-aramex/` (entire folder)

**Create:**
- `src/lib/carriers/aramex-soap.ts`
- `src/app/api/shipments/[id]/label/route.ts`
- `docs/plans/2026-03-20-aramex-integration/progress.md`

**Modify:**
- `src/lib/carriers/adapters/aramex.ts`
- `src/lib/carriers/types.ts`
- `src/lib/services/comparison.ts`
- `src/lib/validations/carriers.ts`
- `src/app/api/carriers/compare/route.ts`
- `src/app/(app)/(dashboard)/shipments/[id]/page.tsx`
- `src/components/compare/results-list.tsx`
- `.env.example`
- `CLAUDE.md`

---

## Task 1: Install Dependency + New Env Vars

**Files:**
- Modify: `.env.example`

**Step 1: Install fast-xml-parser**
```bash
pnpm add fast-xml-parser
```

**Step 2: Add new env vars to `.env.example`**

Add these two lines in the Aramex section (alongside existing ARAMEX_* vars):
```bash
ARAMEX_ACCOUNT_ENTITY=CAS
ARAMEX_ACCOUNT_COUNTRY_CODE=MA
```

Also **remove** `ARAMEX_API_URL` — endpoints are now hardcoded per SOAP service in the adapter.

**Step 3: Verify**
```bash
pnpm tsc --noEmit
```
Expected: No errors.

---

## Task 2: SOAP Utility Layer

**Files:**
- Create: `src/lib/carriers/aramex-soap.ts`

**Step 1: Create the file**

```typescript
import { XMLParser } from "fast-xml-parser";
import { CarrierApiError } from "./types";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const ARAMEX_NS = "http://ws.aramex.net/ShippingAPI/v1/";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,   // strips "v1:" / "soap:" prefixes from keys
  isArray: (name) =>
    ["Notifications", "Shipments", "ProcessedShipments", "TrackingResults"].includes(name),
});

export function buildClientInfo(): string {
  return `
    <v1:ClientInfo>
      <v1:UserName>${process.env.ARAMEX_USERNAME ?? ""}</v1:UserName>
      <v1:Password>${process.env.ARAMEX_PASSWORD ?? ""}</v1:Password>
      <v1:Version>v1.0</v1:Version>
      <v1:AccountNumber>${process.env.ARAMEX_ACCOUNT_NUMBER ?? ""}</v1:AccountNumber>
      <v1:AccountPin>${process.env.ARAMEX_ACCOUNT_PIN ?? ""}</v1:AccountPin>
      <v1:AccountEntity>${process.env.ARAMEX_ACCOUNT_ENTITY ?? "CAS"}</v1:AccountEntity>
      <v1:AccountCountryCode>${process.env.ARAMEX_ACCOUNT_COUNTRY_CODE ?? "MA"}</v1:AccountCountryCode>
    </v1:ClientInfo>`;
}

export function buildEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:v1="${ARAMEX_NS}">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

export async function callAramex(
  endpoint: string,
  soapAction: string,
  xmlBody: string,
): Promise<Record<string, unknown>> {
  const envelope = buildEnvelope(xmlBody);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${soapAction}"`,
    },
    body: envelope,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new CarrierApiError(
      "SERVICE_UNAVAILABLE",
      `Aramex HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const parsed = parser.parse(text) as Record<string, unknown>;

  // Unwrap: Envelope > Body > *Response
  const body = (parsed["Envelope"] as Record<string, unknown>)?.["Body"] as
    | Record<string, unknown>
    | undefined;

  if (!body) {
    throw new CarrierApiError("UNKNOWN", "Aramex: empty SOAP body");
  }

  // The response key is the first child of Body (e.g. "ShipmentCreationResponse")
  const responseKey = Object.keys(body)[0];
  const inner = body[responseKey] as Record<string, unknown>;

  if (!inner) {
    throw new CarrierApiError("UNKNOWN", "Aramex: unrecognised SOAP response");
  }

  // Check HasErrors
  if (inner["HasErrors"] === true || inner["HasErrors"] === "true") {
    const notifications = inner["Notifications"] as
      | Array<{ Code: string; Message: string }>
      | undefined;
    const msg = notifications?.[0]?.Message ?? "Aramex: unknown error";
    throw new CarrierApiError("UNKNOWN", msg);
  }

  return inner;
}
```

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 3: Rewrite AramexAdapter

**Files:**
- Modify: `src/lib/carriers/adapters/aramex.ts`

**Step 1: Replace the entire file**

```typescript
import { callAramex, buildClientInfo } from "../aramex-soap";
import { CarrierApiError } from "../types";
import type {
  CarrierAdapter,
  CreateShipmentInput,
  CarrierShipmentResult,
  TrackingEvent,
} from "../types";

// ── Endpoints ────────────────────────────────────────────────────────────────
const SHIPPING_ENDPOINT =
  "https://ws.aramex.net/shippingapi/shipping/service_1_0.svc";
const TRACKING_ENDPOINT =
  "http://ws.aramex.net/shippingapi/tracking/service_1_0.svc";
const RATE_ENDPOINT =
  "http://ws.staging.aramex.net/ratecalculator/service_1_0.svc";

// ── Status code map ───────────────────────────────────────────────────────────
const STATUS_MAP: Record<
  string,
  "confirmed" | "picked_up" | "in_transit" | "delivered" | "failed"
> = {
  SH001: "confirmed",   // Shipment Booked
  SH003: "confirmed",   // Shipment Data Received
  SH005: "picked_up",   // Shipment Picked Up
  SH006: "delivered",   // Shipment Delivered
  SH009: "failed",      // Delivery Failed
  SH010: "in_transit",  // In Transit
  SH011: "in_transit",  // Out for Delivery
  SH012: "in_transit",  // Arrived at Destination
  SH013: "in_transit",  // Customs Clearance
  SH014: "failed",      // Return to Shipper
  SH015: "failed",      // Shipment Cancelled
  SH016: "in_transit",  // On Hold
  SH017: "in_transit",  // Address Correction
  SH018: "in_transit",  // Attempted Delivery
  SH019: "in_transit",  // Awaiting Customer Collection
  SH020: "in_transit",  // Transferred to Partner
  SH021: "in_transit",  // Received at Origin Station
  SH022: "in_transit",  // Departed Origin Station
  SH023: "in_transit",  // Arrived at Hub
  SH024: "in_transit",  // Departed Hub
  SH025: "in_transit",  // Arrived at Destination Station
  SH026: "in_transit",  // Customs Hold
  SH027: "failed",      // Lost
  SH028: "in_transit",  // Delayed
  SH029: "in_transit",  // Misrouted
  SH030: "in_transit",  // Received at Delivery Station
  SH034: "in_transit",  // In Transit to Hub
};

// ── Adapter ───────────────────────────────────────────────────────────────────
export class AramexAdapter implements CarrierAdapter {
  readonly slug = "aramex";

  async createShipment(input: CreateShipmentInput): Promise<CarrierShipmentResult> {
    const xml = `
      <v1:ShipmentCreationRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>book-${Date.now()}</v1:Reference1></v1:Transaction>
        <v1:Shipments>
          <v1:Shipment>
            <v1:Shipper>
              <v1:Reference1>${process.env.ARAMEX_ACCOUNT_NUMBER ?? ""}</v1:Reference1>
              <v1:AccountNumber>${process.env.ARAMEX_ACCOUNT_NUMBER ?? ""}</v1:AccountNumber>
              <v1:PartyAddress>
                <v1:City>${input.originCity}</v1:City>
                <v1:CountryCode>MA</v1:CountryCode>
              </v1:PartyAddress>
              <v1:Contact>
                <v1:PersonName>Wassalha Sender</v1:PersonName>
                <v1:PhoneNumber1>0600000000</v1:PhoneNumber1>
                <v1:EmailAddress>ops@wassalha.ma</v1:EmailAddress>
              </v1:Contact>
            </v1:Shipper>
            <v1:Consignee>
              <v1:PartyAddress>
                <v1:Line1>${input.recipientAddress}</v1:Line1>
                <v1:City>${input.recipientCity}</v1:City>
                <v1:CountryCode>MA</v1:CountryCode>
              </v1:PartyAddress>
              <v1:Contact>
                <v1:PersonName>${input.recipientName}</v1:PersonName>
                <v1:PhoneNumber1>${input.recipientPhone}</v1:PhoneNumber1>
              </v1:Contact>
            </v1:Consignee>
            <v1:Details>
              <v1:Dimensions>
                <v1:Length>10</v1:Length>
                <v1:Width>10</v1:Width>
                <v1:Height>10</v1:Height>
                <v1:Unit>cm</v1:Unit>
              </v1:Dimensions>
              <v1:ActualWeight>
                <v1:Value>${(input.weightG / 1000).toFixed(3)}</v1:Value>
                <v1:Unit>Kg</v1:Unit>
              </v1:ActualWeight>
              <v1:ProductGroup>EXP</v1:ProductGroup>
              <v1:ProductType>PDX</v1:ProductType>
              <v1:PaymentType>P</v1:PaymentType>
              <v1:NumberOfPieces>1</v1:NumberOfPieces>
              <v1:DescriptionOfGoods>${input.parcelDescription ?? "Merchandise"}</v1:DescriptionOfGoods>
              <v1:CashOnDeliveryAmount>
                <v1:Value>${(input.codAmountMad / 100).toFixed(2)}</v1:Value>
                <v1:CurrencyCode>MAD</v1:CurrencyCode>
              </v1:CashOnDeliveryAmount>
            </v1:Details>
          </v1:Shipment>
        </v1:Shipments>
        <v1:LabelInfo>
          <v1:ReportID>9201</v1:ReportID>
          <v1:ReportType>URL</v1:ReportType>
        </v1:LabelInfo>
      </v1:ShipmentCreationRequest>`;

    const data = await callAramex(
      SHIPPING_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments",
      xml,
    );

    const processed = (
      data["Shipments"] as Array<{ ID: string; ForeignHAWB?: string }> | undefined
    )?.[0];

    if (!processed?.ID) {
      throw new CarrierApiError("UNKNOWN", "Aramex: no shipment ID in response");
    }

    return {
      trackingNumber:   processed.ID,
      carrierReference: processed.ForeignHAWB,
      // labelUrl intentionally omitted — fetched on demand via PrintLabel
    };
  }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingEvent[]> {
    const xml = `
      <v1:ShipmentTrackingRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>track-${Date.now()}</v1:Reference1></v1:Transaction>
        <v1:Shipments>
          <v1:string>${trackingNumber}</v1:string>
        </v1:Shipments>
        <v1:GetLastTrackingUpdateOnly>false</v1:GetLastTrackingUpdateOnly>
      </v1:ShipmentTrackingRequest>`;

    const data = await callAramex(
      TRACKING_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/TrackShipments",
      xml,
    );

    type RawEvent = {
      UpdateCode:        string;
      UpdateDescription: string;
      UpdateDateTime:    string;
      UpdateLocation?:   string;
    };

    const results = data["TrackingResults"] as
      | Array<{ KeyValueOfstringArrayOfTrackingResultmFAkxlpY?: { Value?: RawEvent[] } }>
      | undefined;

    const events: RawEvent[] = results?.[0]?.["KeyValueOfstringArrayOfTrackingResultmFAkxlpY"]?.["Value"] ?? [];

    return events.map((e) => ({
      carrierRawStatus: e.UpdateCode,
      status:           STATUS_MAP[e.UpdateCode] ?? "in_transit",
      location:         e.UpdateLocation,
      description:      e.UpdateDescription,
      occurredAt:       new Date(e.UpdateDateTime),
    }));
  }

  // Not part of CarrierAdapter interface — called directly by comparison service
  async calculateRate(
    originCity: string,
    destCity: string,
    weightG: number,
    codAmountMad: number,
  ): Promise<{ totalMad: number }> {
    const xml = `
      <v1:RateCalculatorRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>rate-${Date.now()}</v1:Reference1></v1:Transaction>
        <v1:OriginAddress>
          <v1:City>${originCity}</v1:City>
          <v1:CountryCode>MA</v1:CountryCode>
        </v1:OriginAddress>
        <v1:DestinationAddress>
          <v1:City>${destCity}</v1:City>
          <v1:CountryCode>MA</v1:CountryCode>
        </v1:DestinationAddress>
        <v1:ShipmentDetails>
          <v1:PaymentType>P</v1:PaymentType>
          <v1:ProductGroup>EXP</v1:ProductGroup>
          <v1:ProductType>PDX</v1:ProductType>
          <v1:ActualWeight>
            <v1:Value>${(weightG / 1000).toFixed(3)}</v1:Value>
            <v1:Unit>KG</v1:Unit>
          </v1:ActualWeight>
          <v1:ChargeableWeight>
            <v1:Value>${(weightG / 1000).toFixed(3)}</v1:Value>
            <v1:Unit>KG</v1:Unit>
          </v1:ChargeableWeight>
          <v1:NumberOfPieces>1</v1:NumberOfPieces>
          <v1:CashOnDeliveryAmount>
            <v1:Value>${(codAmountMad / 100).toFixed(2)}</v1:Value>
            <v1:CurrencyCode>MAD</v1:CurrencyCode>
          </v1:CashOnDeliveryAmount>
        </v1:ShipmentDetails>
      </v1:RateCalculatorRequest>`;

    const data = await callAramex(
      RATE_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CalculateRate",
      xml,
    );

    const total = data["TotalAmount"] as
      | { Value: number | string; CurrencyCode: string }
      | undefined;

    if (!total?.Value) {
      throw new CarrierApiError("UNKNOWN", "Aramex: no rate in response");
    }

    return { totalMad: Number(total.Value) };
  }

  // Called by the label download route
  async printLabel(trackingNumber: string): Promise<string> {
    const xml = `
      <v1:LabelPrintingRequest>
        ${buildClientInfo()}
        <v1:Transaction><v1:Reference1>label-${trackingNumber}</v1:Reference1></v1:Transaction>
        <v1:ShipmentNumber>${trackingNumber}</v1:ShipmentNumber>
        <v1:ProductGroup>EXP</v1:ProductGroup>
        <v1:OriginEntity>${process.env.ARAMEX_ACCOUNT_ENTITY ?? "CAS"}</v1:OriginEntity>
        <v1:LabelInfo>
          <v1:ReportID>9201</v1:ReportID>
          <v1:ReportType>URL</v1:ReportType>
        </v1:LabelInfo>
      </v1:LabelPrintingRequest>`;

    const data = await callAramex(
      SHIPPING_ENDPOINT,
      "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/PrintLabel",
      xml,
    );

    const label = data["ShipmentLabel"] as
      | { LabelURL?: string }
      | undefined;

    if (!label?.LabelURL) {
      throw new CarrierApiError("UNKNOWN", "Aramex: no label URL in response");
    }

    return label.LabelURL;
  }
}
```

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```
Expected: No errors. The `AramexAdapter` still satisfies `CarrierAdapter` (same `slug`, `createShipment`, `getTrackingStatus`).

---

## Task 4: Extend CarrierAdapter Interface

**Files:**
- Modify: `src/lib/carriers/types.ts`

**Step 1: Add optional `calculateRate` to the interface**

After the `getTrackingStatus` line in the `CarrierAdapter` interface, add:

```typescript
// Optional — only implemented by carriers with live rate APIs (currently Aramex only).
// If absent, comparison engine falls back to static DB pricing.
calculateRate?(
  originCity:   string,
  destCity:     string,
  weightG:      number,
  codAmountMad: number,
): Promise<{ totalMad: number }>;
```

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```
Expected: All 5 adapters (Amana, CTM, Marocolis, Sendex) compile fine — the method is optional, so they don't need to implement it.

---

## Task 5: Hybrid Pricing in Comparison Service

**Files:**
- Modify: `src/lib/services/comparison.ts`
- Modify: `src/lib/validations/carriers.ts`

**Step 1: Add `UnavailableCarrier` type and extend `CarrierResult` with `slug`**

In `src/lib/validations/carriers.ts`, update the `CarrierResult` type — add `slug`:

```typescript
export type CarrierResult = {
  carrierId:        string;
  slug:             string;   // ← add this
  name:             string;
  logoUrl:          string | null;
  totalCostMad:     number;
  deliveryDaysMin:  number;
  deliveryDaysMax:  number;
  reliabilityScore: number;
  score:            number;
  codFeeBreakdown: {
    flatMad:    number;
    percentFee: number;
    total:      number;
  };
};

export type UnavailableCarrier = {
  slug:   string;
  name:   string;
  reason: "rate_unavailable";
};
```

**Step 2: Update `compareCarriers` return type and add hybrid pricing**

Replace the entire `src/lib/services/comparison.ts` with this updated version.
Key changes: `RawResult` gains `slug`, the return type gains `unavailable[]`, and a pricing resolution step is inserted before ranking.

```typescript
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { cityToCarrierZoneCode, isCityKnown } from "@/lib/carriers/city-zones";
import { getAdapter } from "@/lib/carriers/adapters";
import type { AramexAdapter } from "@/lib/carriers/adapters/aramex";
import type { CompareInput, CarrierResult, UnavailableCarrier } from "@/lib/validations/carriers";

const MODE_WEIGHTS = {
  cheapest: { cost: 0.7, speed: 0.2, reliability: 0.1 },
  balanced: { cost: 0.4, speed: 0.3, reliability: 0.3 },
  fastest:  { cost: 0.2, speed: 0.5, reliability: 0.3 },
} as const;

export type CompareError =
  | { code: "CITY_NOT_FOUND"; field: "originCity" | "destinationCity" }
  | { code: "NO_RESULTS" };

function raceTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms),
  );
}

export async function compareCarriers(
  input: CompareInput,
): Promise<{ results: CarrierResult[]; unavailable: UnavailableCarrier[] } | { error: CompareError }> {
  if (!isCityKnown(input.destinationCity)) {
    return { error: { code: "CITY_NOT_FOUND", field: "destinationCity" } };
  }

  const activeCarriers = await db.query.carriers.findMany({
    where: eq(carriers.isActive, true),
    with: { zones: { with: { pricing: true } } },
  });

  type RawResult = {
    carrierId:        string;
    slug:             string;
    name:             string;
    logoUrl:          string | null;
    reliabilityScore: number;
    priceMad:         number;
    codFeeMad:        number;
    codFeePercent:    number;
    deliveryDaysMin:  number;
    deliveryDaysMax:  number;
  };

  const matched: RawResult[] = [];

  for (const carrier of activeCarriers) {
    const zoneCode = cityToCarrierZoneCode(input.destinationCity, carrier.slug);
    if (!zoneCode) continue;
    const zone = carrier.zones.find((z) => z.zoneCode === zoneCode);
    if (!zone) continue;
    const tier = zone.pricing.find(
      (p) =>
        p.weightMinG <= input.weightG &&
        (p.weightMaxG === null || p.weightMaxG >= input.weightG),
    );
    if (!tier) continue;

    matched.push({
      carrierId:        carrier.id,
      slug:             carrier.slug,
      name:             carrier.name,
      logoUrl:          carrier.logoUrl,
      reliabilityScore: carrier.reliabilityScore,
      priceMad:         tier.priceMad,
      codFeeMad:        tier.codFeeMad ?? 0,
      codFeePercent:    tier.codFeePercent ? parseFloat(tier.codFeePercent) : 0,
      deliveryDaysMin:  tier.deliveryDaysMin,
      deliveryDaysMax:  tier.deliveryDaysMax,
    });
  }

  if (matched.length === 0) return { results: [], unavailable: [] };

  // ── Hybrid pricing: live rate for Aramex, static DB for others ──────────────
  const unavailable: UnavailableCarrier[] = [];
  const priced: RawResult[] = [];

  await Promise.all(
    matched.map(async (r) => {
      if (r.slug === "aramex") {
        try {
          const adapter = getAdapter("aramex") as AramexAdapter;
          const { totalMad } = await Promise.race([
            adapter.calculateRate(
              input.originCity,
              input.destinationCity,
              input.weightG,
              input.codAmountMad,
            ),
            raceTimeout(3000),
          ]);
          // Override DB priceMad with live rate (in MAD centimes — Aramex returns MAD float)
          priced.push({ ...r, priceMad: Math.round(totalMad * 100) });
        } catch {
          // Timeout or SOAP error — exclude Aramex from ranked results
          unavailable.push({ slug: r.slug, name: r.name, reason: "rate_unavailable" });
        }
      } else {
        priced.push(r);
      }
    }),
  );

  if (priced.length === 0) return { results: [], unavailable };

  // ── Ranking (unchanged logic, now operating on `priced`) ────────────────────
  const costs = priced.map(
    (r) =>
      r.priceMad +
      r.codFeeMad +
      Math.round((r.codFeePercent / 100) * input.codAmountMad),
  );
  const speeds    = priced.map((r) => r.deliveryDaysMin);
  const relScores = priced.map((r) => r.reliabilityScore);

  const minCost  = Math.min(...costs);
  const maxCost  = Math.max(...costs);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const minRel   = Math.min(...relScores);
  const maxRel   = Math.max(...relScores);

  const normalize = (val: number, min: number, max: number, invert: boolean): number => {
    if (max === min) return 1;
    const n = (val - min) / (max - min);
    return invert ? 1 - n : n;
  };

  const weights = MODE_WEIGHTS[input.mode];

  const results: CarrierResult[] = priced.map((r, i) => {
    const totalCost  = costs[i];
    const costScore  = normalize(totalCost, minCost, maxCost, true);
    const speedScore = normalize(r.deliveryDaysMin, minSpeed, maxSpeed, true);
    const relScore   = normalize(r.reliabilityScore, minRel, maxRel, false);

    const score =
      costScore  * weights.cost +
      speedScore * weights.speed +
      relScore   * weights.reliability;

    const percentFee = Math.round((r.codFeePercent / 100) * input.codAmountMad);

    return {
      carrierId:        r.carrierId,
      slug:             r.slug,
      name:             r.name,
      logoUrl:          r.logoUrl,
      totalCostMad:     totalCost,
      deliveryDaysMin:  r.deliveryDaysMin,
      deliveryDaysMax:  r.deliveryDaysMax,
      reliabilityScore: r.reliabilityScore,
      score:            Math.round(score * 1000) / 1000,
      codFeeBreakdown: {
        flatMad:    r.codFeeMad,
        percentFee,
        total:      r.codFeeMad + percentFee,
      },
    };
  });

  results.sort((a, b) => b.score - a.score);
  return { results, unavailable };
}
```

**Step 3: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 6: Update Compare API Route

**Files:**
- Modify: `src/app/api/carriers/compare/route.ts`

**Step 1: Pass through `unavailable[]` in the response**

The route currently returns `NextResponse.json(outcome)` which now includes `unavailable[]` automatically since `compareCarriers` returns it.

The only change: update the `CITY_NOT_FOUND` branch to also include `unavailable: []`:

```typescript
if ("error" in outcome) {
  return NextResponse.json({ results: [], unavailable: [], cityNotFound: true });
}
```

No other changes needed — `outcome` already has `{ results, unavailable }` shape.

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 7: Label Download API Route

**Files:**
- Create: `src/app/api/shipments/[id]/label/route.ts`

**Step 1: Create the route**

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getShipmentById } from "@/lib/services/bookings";
import { getAdapter } from "@/lib/carriers/adapters";
import { CarrierApiError } from "@/lib/carriers/types";
import type { AramexAdapter } from "@/lib/carriers/adapters/aramex";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role =
    (sessionClaims?.publicMetadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const shipment = await getShipmentById(id, userId, role);
  if (!shipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (shipment.carrier.slug !== "aramex") {
    return NextResponse.json(
      { error: "label_not_supported" },
      { status: 400 },
    );
  }

  if (!shipment.carrierTrackingNumber) {
    return NextResponse.json(
      { error: "no_tracking_number" },
      { status: 400 },
    );
  }

  try {
    const adapter = getAdapter("aramex") as AramexAdapter;
    const labelUrl = await adapter.printLabel(shipment.carrierTrackingNumber);
    return NextResponse.redirect(labelUrl, 302);
  } catch (err) {
    if (err instanceof CarrierApiError) {
      return NextResponse.json({ error: "label_unavailable" }, { status: 502 });
    }
    throw err;
  }
}
```

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 8: Update ResultsList — Unavailable Carrier Card

**Files:**
- Modify: `src/components/compare/results-list.tsx`

**Step 1: Accept `unavailable` prop and render greyed-out cards**

Update `ResultsListProps` and add the unavailable section:

```typescript
import type { CarrierResult, UnavailableCarrier, CompareInput } from "@/lib/validations/carriers";

interface ResultsListProps {
  results:      CarrierResult[];
  compareInput: CompareInput;
  unavailable?: UnavailableCarrier[];
}
```

Add below the existing results grid (before the closing `</div>`):

```tsx
{unavailable && unavailable.length > 0 && (
  <div className="mt-4 space-y-2">
    {unavailable.map((c) => (
      <div
        key={c.slug}
        className="rounded-lg border border-dashed p-4 opacity-50"
      >
        <p className="text-sm font-medium text-muted-foreground">{c.name}</p>
        <p className="text-xs text-muted-foreground">
          Rate unavailable — try again later
        </p>
      </div>
    ))}
  </div>
)}
```

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 9: Update Compare Page — Pass `unavailable` to ResultsList

**Files:**
- Modify: `src/app/(app)/(dashboard)/compare/compare-page-client.tsx`

**Step 1: Find where `<ResultsList>` is rendered and pass `unavailable`**

The compare mutation returns `{ results, unavailable }`. Pass `unavailable` through:

```tsx
<ResultsList
  results={data.results}
  compareInput={lastInput}
  unavailable={data.unavailable}
/>
```

Also update the TanStack Query response type in `src/hooks/use-compare.ts` to include `unavailable: UnavailableCarrier[]`.

In `src/hooks/use-compare.ts`, find the response type definition and add:
```typescript
import type { UnavailableCarrier } from "@/lib/validations/carriers";

// In the response type:
unavailable: UnavailableCarrier[];
```

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 10: Download Label Button on Shipment Detail

**Files:**
- Modify: `src/app/(app)/(dashboard)/shipments/[id]/page.tsx`

**Step 1: Add "Download Label" button for Aramex shipments**

In `ShipmentDetailPage`, below the shipment info block, add:

```tsx
{shipment.carrier.slug === "aramex" && shipment.carrierTrackingNumber && (
  <div className="mb-8">
    <a
      href={`/api/shipments/${shipment.id}/label`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Download Waybill Label
    </a>
  </div>
)}
```

This is a plain `<a>` tag — clicking it opens the label PDF URL (after the 302 redirect from Aramex) in a new tab. No client component needed.

**Step 2: Verify**
```bash
pnpm tsc --noEmit
```

---

## Task 11: Delete Mock Routes + Update Env Docs

**Files:**
- Delete: `src/app/api/mock-aramex/` (entire folder)
- Modify: `CLAUDE.md`

**Step 1: Delete the mock folder**
```bash
rm -rf src/app/api/mock-aramex
```

**Step 2: Update `CLAUDE.md`**

In the **Mock Aramex API** line in the project structure section, remove or replace with:
```
# Mock Aramex routes removed — real SOAP adapter uses Aramex staging endpoints
```

In the Tech Stack section, update the Aramex note:
```
**Carrier APIs**: Aramex — real SOAP adapter (staging: ws.dev.aramex.net). Other 4 carriers (Amana/CTM/Marocolis/Sendex) still use stubs.
```

**Step 3: Update `.env.example`** — remove `ARAMEX_API_URL` line (endpoints are now hardcoded in the adapter).

---

## Task 12: Full Verification

**Step 1: Type check + lint + build**
```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```
Expected: No errors. Build output: Aramex mock routes gone from the bundle.

**Step 2: Existing tests**
```bash
pnpm test
```
Expected: 178 tests still pass. The adapter rewrite doesn't affect unit tests (they mock `fetch` or the adapter directly).

**Step 3: Manual — compare with live Aramex rate**
With `ARAMEX_*` staging credentials set in `.env.local`:
```
POST /api/carriers/compare
{ "originCity": "Casablanca", "destinationCity": "Rabat", "weightG": 500, "codAmountMad": 30000, "mode": "balanced" }
```
Expected: Aramex appears in `results[]` with a live `totalCostMad` from the SOAP call.

**Step 4: Manual — book an Aramex shipment**
```
POST /api/shipments
{ "carrierId": "<aramex-id>", ... }
```
Expected: Real waybill number returned (format `1Z...` or similar), stored in `carrierTrackingNumber`.

**Step 5: Manual — download label**
```
GET /api/shipments/<id>/label
```
Expected: 302 redirect to an Aramex label PDF URL.

**Step 6: Manual — tracking poll**
```
GET /api/cron/tracking
```
Expected: Real status events from Aramex staging populate `tracking_events`.

**Step 7: Manual — Aramex SOAP failure**
Temporarily set `ARAMEX_ACCOUNT_NUMBER=bad` and run compare.
Expected: Aramex appears in `unavailable[]`, not `results[]`. Other 4 carriers still rank normally.

---

## Commit Plan

```
feat(aramex): add SOAP utility layer (aramex-soap.ts)
feat(aramex): rewrite adapter — SOAP CreateShipments + TrackShipments + CalculateRate + PrintLabel
feat(compare): hybrid pricing — live Aramex CalculateRate with 3s timeout + graceful exclusion
feat(shipments): add GET /api/shipments/[id]/label route — PrintLabel on-demand 302 redirect
feat(ui): show unavailable carrier cards in ResultsList + Download Label button on shipment detail
chore: delete mock-aramex routes, update env vars + CLAUDE.md
```
