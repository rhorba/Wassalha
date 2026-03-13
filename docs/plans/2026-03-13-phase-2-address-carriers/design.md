# Phase 2 Design — Address Autocomplete + Carrier Database + Admin CRUD

**Date:** 2026-03-13
**Phase:** 2 (Week 2)
**Depends on:** Phase 1 (users table, Clerk auth, middleware, CI)

---

## Scope

Three deliverables:

1. **Carrier Database** — Drizzle schema (carriers, zones, pricing), seed script with 5 Moroccan carriers
2. **Admin CRUD** — API routes + admin UI to manage carriers, zones, and pricing rows
3. **Address Autocomplete** — Reusable React component (Google Places API), no DB table

---

## Schema & Data Flow

### New Drizzle Tables

```ts
// carriers
id          uuid PK
name        text          // "Amana"
slug        text unique   // "amana"
logo_url    text nullable
is_active   boolean default true
created_at  timestamp
updated_at  timestamp

// carrier_zones
id          uuid PK
carrier_id  uuid FK → carriers.id
zone_name   text          // "Zone A", "Casablanca"
zone_code   text          // "ZA"
created_at  timestamp

// carrier_pricing
id                uuid PK
zone_id           uuid FK → carrier_zones.id
weight_min_g      integer       // grams
weight_max_g      integer nullable  // null = no upper limit
price_mad         integer       // centimes (avoid float)
delivery_days_min integer
delivery_days_max integer
created_at        timestamp
```

### Seed Script

- Location: `src/lib/db/seed.ts`
- Command: `pnpm db:seed`
- Seeds: Amana, Chronopost, CTM, Fret Express, Colis Privé
- Idempotent: checks existence before inserting, safe to re-run

### Address Autocomplete

- No DB table — form state only
- Output shape: `{ address: string, lat: number, lng: number }`
- Used in shipment forms (Phase 4) — built now, wired later

---

## API Layer

### Endpoints

```
GET    /api/carriers                                              → list active carriers (public)
GET    /api/carriers/[id]                                        → carrier + zones + pricing (public)
POST   /api/carriers                                             → create carrier (admin)
PUT    /api/carriers/[id]                                        → update carrier (admin)
DELETE /api/carriers/[id]                                        → soft delete is_active=false (admin)

POST   /api/carriers/[id]/zones                                  → add zone (admin)
DELETE /api/carriers/[id]/zones/[zoneId]                         → delete zone (admin)

POST   /api/carriers/[id]/zones/[zoneId]/pricing                 → add pricing row (admin)
DELETE /api/carriers/[id]/zones/[zoneId]/pricing/[pricingId]     → delete pricing row (admin)
```

### Service Layer

`src/lib/services/carriers.ts` — all Drizzle queries live here. Route handlers call services only.

### Zod Schemas

`src/lib/validations/carriers.ts`:

```ts
CreateCarrierSchema   // name, slug, logo_url?
CreateZoneSchema      // zone_name, zone_code
CreatePricingSchema   // weight_min_g, weight_max_g?, price_mad, delivery_days_min, delivery_days_max
```

### Auth Guard

- `GET` endpoints: public (comparison engine needs them unauthenticated)
- Write endpoints: check `sessionClaims.metadata.role === "admin"` via Clerk

---

## Frontend Components

### Admin Pages

```
src/app/(dashboard)/admin/carriers/
  page.tsx           → carrier list table (RSC)
  new/page.tsx       → create carrier form
  [id]/page.tsx      → edit carrier + manage zones + pricing
```

### Component Breakdown

| Component | Type | Description |
|-----------|------|-------------|
| `CarrierTable` | Client | shadcn Table — name, slug, zone count, active toggle, actions |
| `CarrierForm` | Client | React Hook Form + Zod — name, slug, logo_url |
| `ZoneAccordion` | Client | shadcn Accordion — one section per zone, inline pricing rows |
| `PricingRow` | Client | Weight range + price + delivery days, add/delete inline |
| `AddressAutocomplete` | Client | Google Places input → `{ address, lat, lng }` via onChange |

### Data Fetching Strategy

- RSC for initial carrier list (no loading spinner on first paint)
- TanStack Query for all mutations (create/update/delete) with optimistic table updates
- `AddressAutocomplete` at `src/components/forms/AddressAutocomplete.tsx` — standalone, used in Phase 4 shipment forms

### Admin Navigation

Add "Carriers" link to dashboard sidebar. Rendered only when `role === "admin"`.

---

## Error Handling & Edge Cases

### API Error Shape

```ts
{ error: string, code?: string }
// 400 — Zod validation failure
// 403 — non-admin write attempt
// 404 — carrier/zone/pricing not found
// 409 — slug conflict OR zone has pricing rows (delete guard)
```

### Edge Cases

| Case | Handling |
|------|----------|
| Slug conflict | `409` on create/update |
| Delete carrier with zones | Cascade delete zones + pricing (FK) |
| Delete zone with pricing rows | `409` — must delete pricing first |
| Soft delete | `is_active = false` only — data preserved for Phase 4+ |
| Pricing gaps | No contiguous validation (Phase 3 handles "no match") |
| Google Places API down | `AddressAutocomplete` falls back to plain text input |
| Seed re-run | Idempotent — no duplicate data |

---

## File Map

```
src/
  lib/
    db/
      schema/
        carriers.ts          ← new
        index.ts             ← updated (re-export carriers)
      seed.ts                ← new
    services/
      carriers.ts            ← new
    validations/
      carriers.ts            ← new
  app/
    api/
      carriers/
        route.ts             ← GET list, POST create
        [id]/
          route.ts           ← GET, PUT, DELETE
          zones/
            route.ts         ← POST zone
            [zoneId]/
              route.ts       ← DELETE zone
              pricing/
                route.ts     ← POST pricing
                [pricingId]/
                  route.ts   ← DELETE pricing
    (dashboard)/
      admin/
        carriers/
          page.tsx           ← carrier list (RSC)
          new/
            page.tsx         ← create form
          [id]/
            page.tsx         ← edit + zones + pricing
  components/
    forms/
      AddressAutocomplete.tsx ← new
```

---

## Out of Scope (Phase 3+)

- Address → carrier zone resolution (Phase 3)
- Carrier API credentials / adapter pattern (Phase 3)
- Shipment creation using addresses (Phase 4)
- Weight normalization / unit conversion UI (Phase 4)
