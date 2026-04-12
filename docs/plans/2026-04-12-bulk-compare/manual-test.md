# Bulk Import — Manual Test Scenarios

**Page:** `/compare` → Bulk Import tab
**Date:** 2026-04-12
**Tester:** ___________

---

## Test CSV Files

Save the blocks below as local files before starting. The paths suggested are relative to your Downloads folder.

### `bulk-valid.csv` — 6 valid rows, mixed modes
```csv
label,originCity,destinationCity,weightG,codAmountMad,mode
Order #001,Casablanca,Marrakech,500,150000,
Order #002,Rabat,Fes,1200,80000,cheapest
Order #003,Casablanca,Tanger,300,200000,fastest
Order #004,Marrakech,Agadir,800,50000,balanced
Order #005,Casablanca,Oujda,2000,120000,
Order #006,Rabat,Meknes,600,75000,cheapest
```

### `bulk-mixed-errors.csv` — valid rows + rows that will fail
```csv
label,originCity,destinationCity,weightG,codAmountMad,mode
Good Row,Casablanca,Marrakech,500,150000,balanced
Bad Weight,,Fes,abc,0,
Missing City,Rabat,,400,50000,
Good Row 2,Tanger,Agadir,900,60000,fastest
Unknown Dest,Casablanca,Paris,500,100000,balanced
```
> Rows 2 and 3 have client-side parse errors (blank cities / non-integer weight).
> Row 5 (`Paris`) will pass client validation but server returns `cityNotFound: true`.

### `bulk-empty-required.csv` — all rows invalid (parse error gate test)
```csv
label,originCity,destinationCity,weightG,codAmountMad,mode
No cities,,,500,100000,
Also bad,,Marrakech,0,100000,
```

---

## Smoke Tests

### S1 — Template download

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to `/compare` → click **Bulk Import** tab | Tab becomes active, drop zone visible |
| 2 | Click **Download Template** | `wassalha-bulk-template.csv` downloads |
| 3 | Open the file | Contains header `label,originCity,destinationCity,weightG,codAmountMad,mode` + 2 example rows |

**Pass / Fail:** ___

---

### S2 — Valid CSV upload → preview state

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click the drop zone (or drag `bulk-valid.csv` onto it) | Drop zone highlights on hover |
| 2 | Select `bulk-valid.csv` | Panel switches to **parsing** (pulsing text) then **preview** |
| 3 | Inspect preview | "6 valid row(s) ready for comparison" — no error banner |
| 4 | Verify mode toggle still shows **Balanced** | Mode is set globally |

**Pass / Fail:** ___

---

### S3 — Run comparison → results table

| Step | Action | Expected |
|------|--------|----------|
| 1 | From preview state, click **Run Comparison ▶** | Skeleton rows animate for 1–3 s |
| 2 | Results table appears | 6 rows, columns: `#`, `Label`, `Route`, `Weight`, `COD`, `Best Carrier`, `Cost`, `Days`, `Action` |
| 3 | Check row 1 | Label = "Order #001", Route = "Casablanca → Marrakech", Best Carrier filled |
| 4 | Check row 2 | Label = "Order #002" — mode override `cheapest` applied (cheapest carrier shown) |
| 5 | Rows with no carrier result show amber badge | N/A for this file — all routes valid |

**Pass / Fail:** ___

---

### S4 — Expand row accordion

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click the chevron (▶) on any result row | Row expands |
| 2 | Inspect accordion content | Sub-heading "All carriers for row N", grid of `CarrierResultCard` components |
| 3 | Verify first card has **Best Match** badge | Top-ranked carrier flagged |
| 4 | Each card has a **Réserver →** button | Opens booking sheet for that carrier |
| 5 | Click another row's chevron | Both rows can be open simultaneously |

**Pass / Fail:** ___

---

### S5 — Per-row Book button

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click **Book** button on row 1 (table row, not inside accordion) | Row shows "Booking…" spinner |
| 2 | Wait for result | Row shows green **Booked** badge + row background turns green |
| 3 | Checkbox for that row is now disabled | Cannot re-select a booked row |
| 4 | Click **Book** on row 2 | Same behaviour — independent of row 1 |

**Pass / Fail:** ___

---

### S6 — Select all + bulk booking confirmation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click **Select all (N)** checkbox in toolbar | All bookable rows check (booked rows skip) |
| 2 | Count shows e.g. "Book Selected (4)" | Reflects remaining unbooked bookable rows |
| 3 | Click **Book Selected (N)** | Confirmation dialog opens |
| 4 | Dialog shows each selected row: label, carrier, cost | Rows listed with individual costs |
| 5 | Dialog footer shows **Total estimated cost** | Sum of all selected rows |
| 6 | Click **Cancel** | Dialog closes, selection preserved |
| 7 | Re-open dialog, click **Confirm & Book All** | Dialog closes, progress shows "Booking 1 of N…" |
| 8 | All selected rows turn green | Success toast "Booked N shipment(s)" |
| 9 | "All shipments booked successfully." banner appears | Only when every bookable row is booked |

**Pass / Fail:** ___

---

### S7 — Export CSV results

| Step | Action | Expected |
|------|--------|----------|
| 1 | With results visible, click **Export CSV** | `bulk-compare-results.csv` downloads |
| 2 | Open the file | Header: `row,label,origin,destination,weightG,codAmountMad,bestCarrier,costMAD,daysMin,daysMax,error` |
| 3 | Check row count | 6 data rows matching the uploaded file |
| 4 | Verify costs | `costMAD` column contains decimal values (e.g. `45.00`) |

**Pass / Fail:** ___

---

### S8 — Upload new file (reset)

| Step | Action | Expected |
|------|--------|----------|
| 1 | With results visible, click **New Import** | Panel resets to **idle** (drop zone reappears) |
| 2 | Upload `bulk-valid.csv` again | Preview shows 6 valid rows |
| 3 | Click **Upload New File** from preview | Panel resets to idle drop zone |

**Pass / Fail:** ___

---

### S9 — File with client-side parse errors

| Step | Action | Expected |
|------|--------|----------|
| 1 | Upload `bulk-mixed-errors.csv` | Preview state |
| 2 | Red error banner appears | "2 row(s) have validation errors and will be skipped" |
| 3 | Error list names rows 2 and 3 with specific messages | e.g. "originCity: Origin city required", "weightG: Weight must be at least 1g" |
| 4 | "2 valid row(s) ready for comparison" shown below | Rows 1, 4, 5 pass client validation |
| 5 | Click **Run Comparison ▶** | Sends 3 rows to server |
| 6 | In results table, rows 1 and 4 show carriers | Valid destinations |
| 7 | Row 5 (`Paris`) shows amber **City not found** badge | Server returned `cityNotFound: true` |
| 8 | Row 5 `Book` button is absent | No carrier to book |

**Pass / Fail:** ___

---

### S10 — All rows invalid (blocked before submission)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Upload `bulk-empty-required.csv` | Preview state |
| 2 | Red error banner lists 2 rows | Both rows flagged |
| 3 | "No valid rows found" message shown | **Run Comparison** button absent |
| 4 | Only **Upload New File** button visible | User must fix file |

**Pass / Fail:** ___

---

### S11 — Wrong file extension

| Step | Action | Expected |
|------|--------|----------|
| 1 | Rename any CSV to `test.txt`, try to upload it | Sonner toast error: "Unsupported file type — use .csv, .xlsx, or .xls" |
| 2 | Drop zone resets to idle | No state change |

**Pass / Fail:** ___

---

### S12 — Single tab regression check

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click the **Single** tab | Single compare form renders |
| 2 | Fill in origin / destination / weight / COD and submit | Carrier cards render as before |
| 3 | Switch to **Bulk Import** tab and back to **Single** | Results preserved |

**Pass / Fail:** ___

---

### S13 — Global mode affects comparison

| Step | Action | Expected |
|------|--------|----------|
| 1 | Upload `bulk-valid.csv`, set global mode to **Cheapest** before clicking Run | Mode toggle shows Cheapest |
| 2 | Run comparison | Row #001 (no mode override) uses Cheapest — cheapest carrier ranked first |
| 3 | Row #002 (`mode: cheapest` in file) — same result | Per-row override matches global |
| 4 | Row #003 (`mode: fastest` in file) | Fastest carrier ranked first in that row's accordion |

**Pass / Fail:** ___

---

### S14 — Drag and drop

| Step | Action | Expected |
|------|--------|----------|
| 1 | Drag `bulk-valid.csv` over the drop zone (don't release) | Border turns blue, background tints |
| 2 | Release file | Parses and enters preview state |
| 3 | Drag an invalid file type (e.g. `.txt`) over the zone | Highlights normally |
| 4 | Release | Toast error — "Unsupported file type" |

**Pass / Fail:** ___

---

## Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| S1 — Template download | | |
| S2 — Valid CSV preview | | |
| S3 — Comparison results | | |
| S4 — Accordion expand | | |
| S5 — Per-row book | | |
| S6 — Bulk book + dialog | | |
| S7 — Export CSV | | |
| S8 — Reset / new import | | |
| S9 — Mixed errors + city not found | | |
| S10 — All rows invalid | | |
| S11 — Wrong extension | | |
| S12 — Single tab regression | | |
| S13 — Global mode effect | | |
| S14 — Drag and drop | | |

**Overall:** Pass / Fail / Partial — Notes: ___________
