# Phase 3 — Comparison Engine: Design

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Carrier comparison feature allowing retailers to find the best carrier for a shipment by entering weight, origin city, destination city, and COD amount. Results are ranked by a configurable mode (Cheapest / Balanced / Fastest).

---

## Inputs

| Field | Type | Notes |
|-------|------|-------|
| `originCity` | string | Normalized to lowercase, mapped to zone code via static JSON |
| `destinationCity` | string | Primary zone lookup — must match a carrier zone |
| `weightG` | integer | Weight in grams |
| `codAmountMad` | integer | COD amount in centimes — displayed in breakdown, factored into COD fee calc |
| `mode` | enum | `cheapest` \| `balanced` \| `fastest`, default `balanced` |

---

## Schema Changes

### Migration 1 — `carriers` table
```ts
reliabilityScore: integer('reliability_score').default(80).notNull()
// 0–100, admin-set via existing carrier edit panel
```

### Migration 2 — `carrier_pricing` table
```ts
codFeeMad:     integer('cod_fee_mad'),                                   // flat COD fee in centimes, nullable
codFeePercent: numeric('cod_fee_percent', { precision: 5, scale: 2 }),  // e.g. 1.50 = 1.5%, nullable
```

### Zod schema update — `CreatePricingSchema`
Add optional `codFeeMad` and `codFeePercent` fields. Refinement: if `codFeePercent` is set, must be between 0–100.

---

## City-to-Zone Mapping

**File:** `src/lib/carriers/city-zones.json`

Static JSON mapping lowercase city names to zone codes matching `carrier_zones.zoneCode`:

```json
{
  "casablanca": "ZA",
  "rabat": "ZB",
  "marrakech": "ZC",
  "fes": "ZD",
  "tanger": "ZE"
}
```

- Keys normalized via `city.toLowerCase().trim()` before lookup
- Origin city used for display only in MVP (no origin-zone pricing)
- Covers Morocco's ~30 major cities

---

## API

### Endpoint
`POST /api/carriers/compare`
- Auth: any authenticated user (not admin-only)
- No caching — always fresh

### Request (Zod-validated)
```ts
CompareInputSchema = z.object({
  originCity:      z.string().min(2),
  destinationCity: z.string().min(2),
  weightG:         z.number().int().min(1),
  codAmountMad:    z.number().int().min(0),
  mode:            z.enum(['cheapest', 'balanced', 'fastest']).default('balanced'),
})
```

### Service Logic (`src/lib/services/comparison.ts`)

1. Normalize `destinationCity` → look up `zoneCode` from `city-zones.json`
2. Query all active carriers that have a `carrier_zones` row matching `zoneCode`
3. For each carrier, find pricing tier where `weightMinG <= weightG < weightMaxG` (null `weightMaxG` = unlimited)
4. Calculate total cost:
   ```ts
   totalCost = priceMad
             + (codFeeMad ?? 0)
             + Math.round((codFeePercent ?? 0) / 100 * codAmountMad)
   ```
5. Score each result using normalized min-max per signal, then apply mode weights:

| Signal | Cheapest | Balanced | Fastest |
|--------|----------|----------|---------|
| Cost (lower = better) | 70% | 40% | 20% |
| Speed (lower days = better) | 20% | 30% | 50% |
| Reliability (higher = better) | 10% | 30% | 30% |

6. Sort results by score descending.

### Response — `CarrierResult[]`
```ts
{
  carrierId:        string
  name:             string
  logoUrl:          string | null
  totalCostMad:     number   // in centimes
  deliveryDaysMin:  number
  deliveryDaysMax:  number
  reliabilityScore: number   // 0–100
  score:            number   // 0–1 composite
  codFeeBreakdown: {
    flatMad:    number
    percentFee: number
    total:      number
  }
}
```

---

## Frontend

### Route
`src/app/(dashboard)/compare/page.tsx`

### Component Structure

```
compare/
├── page.tsx               # Server Component shell
├── compare-form.tsx       # Client — React Hook Form + Zod
├── mode-toggle.tsx        # Client — shadcn/ui ToggleGroup
├── results-list.tsx       # Client — sorted result cards
└── carrier-result-card.tsx # Client — single result display
```

### Input Form (Phase 1)

```
┌─────────────────────────────┐
│  From city  │  To city      │  ← Google Places autocomplete (existing)
│  Weight (g) │  COD (MAD)    │
│  [Cheapest] [Balanced✓] [Fastest]  │  ← ModeToggle
│        [Compare Carriers]           │
└─────────────────────────────┘
```

### Results (Phase 2 — replaces form on mobile)

```
┌─────────────────────────────┐
│ Sort: [Price] [Speed] [Score✓]      │  ← client-side only
│─────────────────────────────│
│ 🏆 Amana          45 MAD   │  ← top-scored badge
│    1–2 days  ★★★★☆         │
│         [Book Now →]        │  ← stub, links to Phase 4
│─────────────────────────────│
│ Chronopost        38 MAD   │
│    1–1 day   ★★★★★         │
│         [Book Now →]        │
└─────────────────────────────┘
```

### Data Flow

- `useCompare` TanStack Query hook — fires `POST /api/carriers/compare` on form submit
- Sort is **client-side only** — no refetch on sort change
- "Book Now" links to `/dashboard/shipments/new?carrierId=xxx` (disabled stub for Phase 4)

### Key Components

| Component | Type | Library |
|-----------|------|---------|
| `CompareForm` | Client | React Hook Form + Zod |
| `ModeToggle` | Client | shadcn/ui ToggleGroup |
| `ResultsList` | Client | TanStack Query + local sort state |
| `CarrierResultCard` | Client | shadcn/ui Card |
| Address inputs | Client | Existing Google Places autocomplete hook |

---

## Error States

| Case | Handling |
|------|---------|
| City not found in JSON | Return 422 with `{ error: 'city_not_found', field: 'destinationCity' }` |
| No carrier covers destination zone | Return 200 with empty array + `{ message: 'no_coverage' }` |
| No pricing tier matches weight | Skip that carrier silently (not shown in results) |
| All carriers skipped | Return 200 with empty array + `{ message: 'no_results' }` |

---

## Out of Scope (Phase 3)

- COD fee schema changes to admin UI (Phase 4)
- Origin zone pricing (origin city = display only)
- Real carrier API integration (Phase 5)
- Booking flow from results (Phase 4)
