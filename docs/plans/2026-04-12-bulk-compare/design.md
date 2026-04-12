# Bulk Compare — Design

**Date:** 2026-04-12
**Status:** Validated

## Overview

Add a "Bulk Import" tab to the carrier compare page. Users upload a CSV or Excel file of shipments, run a single batch comparison, and get ranked carrier results for every row — with the ability to book any or all from the same screen.

---

## Decisions

| Question | Decision |
|---|---|
| Primary use case | Pre-shipment planning + batch booking |
| File formats | CSV + Excel (.xlsx) via SheetJS (dynamic import) |
| Priority mode | Global default + optional per-row override column |
| Results display | Expandable rows — all available carriers per row |
| Booking UX | Checkboxes + per-row "Book" + confirmation dialog |
| Processing | Single bulk API endpoint; booking via existing individual endpoint |

---

## Section 1 — API Layer & Data Flow

**New endpoint:** `POST /api/carriers/compare/bulk`

Request body:
```json
{
  "globalMode": "balanced",
  "rows": [
    { "rowIndex": 0, "label": "Order #123", "originCity": "Casablanca", "destinationCity": "Marrakech", "weightG": 500, "codAmountMad": 1500 },
    { "rowIndex": 1, "originCity": "Rabat", "destinationCity": "Fes", "weightG": 1000, "codAmountMad": 2000, "mode": "cheapest" }
  ]
}
```

- Max **50 rows** per request, validated with Zod.
- `mode` per row is optional — falls back to `globalMode`.
- Server calls the existing `compareCarriers()` service **sequentially** per row (avoids DB connection surge).
- Rate limit: **3 req/min** (`rl:compare-bulk` key in Upstash), separate from single compare's 20/min.
- Booking stays on the existing `POST /api/shipments` — one call per row when user confirms.

Response:
```json
{
  "results": [
    { "rowIndex": 0, "label": "Order #123", "bestCarrier": {...}, "allResults": [...], "cityNotFound": false, "error": null },
    { "rowIndex": 1, "label": null, "bestCarrier": null, "allResults": [], "cityNotFound": true, "error": "Destination city not found" }
  ]
}
```

Rows with errors are returned inline — the request never fails wholesale; partial results are always returned.

---

## Section 2 — File Format & Parsing

**CSV template columns:**
```
label,originCity,destinationCity,weightG,codAmountMad,mode
Order #123,Casablanca,Marrakech,500,1500,
Order #124,Rabat,Fes,1000,2000,cheapest
```

- `label` — optional, free text (order ref, SKU, etc.)
- `mode` — optional; empty cells inherit `globalMode`
- `weightG` and `codAmountMad` must be integers

**Excel support:** SheetJS (`xlsx`) loaded via dynamic import — zero impact on initial bundle. First sheet only parsed; same columns expected.

**Client-side parsing flow:**
1. User drops/selects file → `FileReader` reads as `ArrayBuffer`
2. Dynamic import of `xlsx` → parse to row objects
3. Client validates each row with Zod `BulkCompareRowSchema`
4. Invalid rows shown in a **pre-submission error table** (red highlight, error per cell)
5. Valid rows shown in **preview table** (row count, column summary) + "Run Comparison" button
6. On submit → `POST /api/carriers/compare/bulk`

**Template download:** static CSV string, no server call.

**Client-side limits:**
- Max 50 rows (banner warning if file exceeds — first 50 used)
- File size ≤ 2MB
- Accepted extensions: `.csv`, `.xlsx`, `.xls`

---

## Section 3 — UI Components

**Page change:** `compare-page-client.tsx` adds shadcn `Tabs`:
```
[ Single ]  [ Bulk Import ]
```

**`BulkImportPanel`** — new client component, owns the full bulk flow:

```
┌─────────────────────────────────────────────┐
│  Mode: [Cheapest] [Balanced] [Fastest]       │  ← global ModeToggle
│  [Download Template]                         │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │   Drop CSV / Excel here              │    │  ← drag-and-drop zone
│  │   or click to browse                 │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [Preview table or error table]              │
│  [Run Comparison ▶]                          │
└─────────────────────────────────────────────┘
```

**Results table:**
- Columns: `#`, `Label`, `Route`, `Weight`, `COD`, `Best Carrier`, `Cost`, `Days`, `Actions`
- Expandable rows (accordion) → all ranked carriers (reuses `CarrierResultCard`)
- Row-level "Book" button + checkbox
- Sticky header: `☐ Select All` · `Book Selected (N)` (disabled until ≥1 selected)
- "Book Selected" → shadcn `Dialog` confirmation: N shipments, total cost, carrier breakdown
- **Export CSV** button top-right

**Internal state machine:**
```
idle → parsed → (error | preview) → comparing → results
```

Mobile: table scrolls horizontally; accordion rows stack vertically.

---

## Section 4 — Error Handling & Edge Cases

**Parse errors (client-side):**
- Non-integer `weightG` / `codAmountMad` → row red, blocked from submission
- Empty required fields → red highlight + tooltip
- >50 rows → banner "File has N rows — only the first 50 will be compared"
- File >2MB or wrong extension → toast error, upload zone resets
- Unknown city names → warning icon, still submits (server returns `cityNotFound: true` inline)

**API errors:**
- 429 → toast: "Too many bulk requests — please wait N seconds"
- Partial row failures (`cityNotFound`, no carriers) → inline amber badge per row; rest of results display
- 500 → toast error + "Retry" button; results state preserved

**Booking errors:**
- Per-row "Book" failure → row turns red with error; other rows unaffected
- Bulk "Book Selected" → sequential with progress indicator (`Booking 3 of 7…`); individual failures shown inline without cancelling remaining bookings

**Loading states:**
- Upload: spinner while parsing (SheetJS dynamic import ~200ms first time)
- Comparison: skeleton rows while bulk API is in flight
- Booking: per-row spinner, "Book Selected" shows progress count

**Empty states:**
- No carriers for any row → "No carriers available for any of the uploaded routes"
- All rows city errors → prompt to re-download template and check city names
