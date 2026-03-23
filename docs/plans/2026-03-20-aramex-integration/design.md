# Aramex Real API Integration — Design

## Overview

Replace the local JSON mock Aramex adapter with a real SOAP client that calls official Aramex staging/production endpoints. Covers shipment creation, tracking, live rate calculation in the comparison engine, and on-demand label printing.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| SOAP client | Raw XML + `fast-xml-parser` | No WSDL dep at runtime, easy to mock in tests via `fetch` stub, full control over envelope |
| CalculateRate | Live call in compare engine, 3s timeout, graceful exclusion | Static DB has no accurate Aramex pricing — showing stale rates erodes retailer trust |
| Mock strategy | Delete mock routes, use Aramex official staging (`ws.dev.aramex.net`) | Zero mock maintenance; real SOAP parsing tested against real endpoints |
| CreatePickup | Skip | Beta retailers have standing daily pickup agreements — no on-demand scheduling needed yet |
| Label storage | PrintLabel on-demand → 302 redirect | Aramex label URLs are ephemeral (~48h); `PrintLabel` always returns a fresh URL, no blob storage needed |
| Status codes | Full ~30-code STATUS_MAP | Sparse map risks misleading `in_transit` badges for `failed`/`delivered` codes |

---

## Architecture

### Files Changed

**Deleted:**
- `src/app/api/mock-aramex/` — entire folder, dead code

**New:**
- `src/lib/carriers/aramex-soap.ts` — shared SOAP utility (envelope builder + HTTP caller + parser)
- `src/app/api/shipments/[id]/label/route.ts` — PrintLabel on-demand, 302 redirect

**Modified:**
- `src/lib/carriers/adapters/aramex.ts` — full rewrite to SOAP
- `src/lib/carriers/types.ts` — optional `calculateRate?()` on `CarrierAdapter` interface
- `src/lib/services/comparison.ts` — hybrid pricing (live Aramex + static DB)
- `src/lib/validations/carriers.ts` — add `slug` to `CarrierResult`, add `UnavailableCarrier` type
- `src/app/api/carriers/compare/route.ts` — pass through `unavailable[]`
- `src/components/compare/results-list.tsx` — greyed-out unavailable carrier cards
- `src/app/(app)/(dashboard)/compare/compare-page-client.tsx` — pass `unavailable` prop
- `src/hooks/use-compare.ts` — add `unavailable: UnavailableCarrier[]` to response type
- `src/app/(app)/(dashboard)/shipments/[id]/page.tsx` — Download Label button for Aramex
- `.env.example` — add `ARAMEX_ACCOUNT_ENTITY`, `ARAMEX_ACCOUNT_COUNTRY_CODE`; remove `ARAMEX_API_URL`
- `CLAUDE.md` — update carrier adapter notes

---

## Section 1 — SOAP Utility Layer (`aramex-soap.ts`)

Three functions:

**`buildClientInfo(): string`**
Returns the XML `<ClientInfo>` block populated from env vars:
- `ARAMEX_USERNAME`, `ARAMEX_PASSWORD`, `Version: "v1.0"`
- `ARAMEX_ACCOUNT_NUMBER`, `ARAMEX_ACCOUNT_PIN`
- `ARAMEX_ACCOUNT_ENTITY` (e.g. `CAS`), `ARAMEX_ACCOUNT_COUNTRY_CODE` (`MA`)

**`buildEnvelope(body: string): string`**
Wraps any XML body in the standard SOAP envelope:
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:v1="http://ws.aramex.net/ShippingAPI/v1/">
  <soap:Body>{{ body }}</soap:Body>
</soap:Envelope>
```

**`callAramex(endpoint, soapAction, xmlBody): Promise<Record<string, unknown>>`**
- `fetch()` with `Content-Type: text/xml` + `SOAPAction` header
- Parse response with `fast-xml-parser` (`removeNSPrefix: true` strips `v1:` / `soap:` prefixes)
- Unwrap SOAP envelope → return inner response object
- Check `HasErrors === true` → throw `CarrierApiError("UNKNOWN", Notifications[0].Message)`

---

## Section 2 — AramexAdapter Rewrite

### Endpoints
| Service | URL |
|---|---|
| Shipping (Create + PrintLabel) | `https://ws.aramex.net/shippingapi/shipping/service_1_0.svc` |
| Tracking | `http://ws.aramex.net/shippingapi/tracking/service_1_0.svc` |
| Rate Calculator | `http://ws.staging.aramex.net/ratecalculator/service_1_0.svc` |

### Methods

**`createShipment(input)`** — calls `CreateShipments` SOAP
- Shipper: `ARAMEX_ACCOUNT_NUMBER` + `originCity` + `CountryCode: MA`
- Consignee: recipient fields + `CountryCode: MA`
- Weight: `weightG / 1000` Kg
- COD: `codAmountMad / 100` MAD
- `LabelInfo` included in request but `labelUrl` NOT returned (fetched on demand)
- Returns `{ trackingNumber: ProcessedShipment.ID, carrierReference: ForeignHAWB }`

**`getTrackingStatus(trackingNumber)`** — calls `TrackShipments` SOAP
- `GetLastTrackingUpdateOnly: false` — full history
- Maps `UpdateCode` → status via full 27-code `STATUS_MAP`

**`calculateRate(originCity, destCity, weightG, codAmountMad)`** — calls `CalculateRate` SOAP
- Public method, NOT on `CarrierAdapter` interface
- `ProductGroup: EXP`, `ProductType: PDX`, `PaymentType: P`
- Returns `{ totalMad: number }`

**`printLabel(trackingNumber)`** — calls `PrintLabel` SOAP
- Public method, NOT on `CarrierAdapter` interface
- `ReportID: 9201`, `ReportType: URL`
- Returns fresh label PDF URL string

### Full STATUS_MAP
```
SH001 → confirmed   SH003 → confirmed   SH005 → picked_up
SH006 → delivered   SH009 → failed      SH010 → in_transit
SH011 → in_transit  SH012 → in_transit  SH013 → in_transit
SH014 → failed      SH015 → failed      SH016 → in_transit
SH017 → in_transit  SH018 → in_transit  SH019 → in_transit
SH020 → in_transit  SH021 → in_transit  SH022 → in_transit
SH023 → in_transit  SH024 → in_transit  SH025 → in_transit
SH026 → in_transit  SH027 → failed      SH028 → in_transit
SH029 → in_transit  SH030 → in_transit  SH034 → in_transit
Default fallback → in_transit
```

---

## Section 3 — Hybrid Pricing in Comparison Engine

**Current flow:** all carriers → static DB pricing → rank

**New flow:**
```
carriers from DB
  ├── Aramex → Promise.race([calculateRate(...), timeout(3s)])
  │     ├── success → override priceMad with live rate
  │     └── timeout / CarrierApiError → push to unavailable[], exclude from ranking
  └── others → static DB pricing (unchanged)

return { results: RankedCarrier[], unavailable: UnavailableCarrier[] }
```

**Key behaviours:**
- `POST /api/carriers/compare` always returns `200` — Aramex failure never crashes the endpoint
- `unavailable[]` carries `{ slug, name, reason: "rate_unavailable" }` for frontend display
- `CarrierResult` type gains `slug: string` field
- `UnavailableCarrier` type added to `src/lib/validations/carriers.ts`

---

## Section 4 — Label Download Route

```
GET /api/shipments/[id]/label

1. Clerk auth → userId + role
2. getShipmentById(id, userId, role) → 404 if not found / not owned
3. shipment.carrier.slug !== "aramex" → 400 { error: "label_not_supported" }
4. !shipment.carrierTrackingNumber → 400 { error: "no_tracking_number" }
5. adapter.printLabel(trackingNumber) → fresh LabelURL
6. return 302 redirect to LabelURL
7. CarrierApiError → 502 { error: "label_unavailable" }
```

No DB changes. No blob storage. Label always fresh.

---

## Section 5 — Frontend Changes

**`results-list.tsx`**
- New prop: `unavailable?: UnavailableCarrier[]`
- Renders greyed-out dashed-border cards below ranked results for each unavailable carrier
- Text: carrier name + "Rate unavailable — try again later"

**`shipments/[id]/page.tsx`**
- "Download Waybill Label" `<a>` link rendered only when `shipment.carrier.slug === "aramex"` and `carrierTrackingNumber` exists
- Links to `/api/shipments/${id}/label`, opens in new tab
- Plain `<a>` — no client component needed (RSC page)

---

## New Env Vars

```bash
ARAMEX_ACCOUNT_ENTITY=CAS          # Aramex station code for Casablanca
ARAMEX_ACCOUNT_COUNTRY_CODE=MA     # ISO country code
# ARAMEX_API_URL — REMOVED (endpoints hardcoded per SOAP service)
```
