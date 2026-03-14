# Phase 3 — Comparison Engine: Test Plan

**Date:** 2026-03-14
**Status:** ✅ All tests passed

---

## Unit Tests — Comparison Service

**File:** `src/lib/services/__tests__/comparison.test.ts`

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | Returns `CITY_NOT_FOUND` for unknown destination | `{ error: { code: "CITY_NOT_FOUND", field: "destinationCity" } }` | ✅ |
| 2 | Does not validate origin city (only destination triggers error) | Returns empty results, no error | ✅ |
| 3 | Returns empty array when no carriers cover zone | `{ results: [] }` | ✅ |
| 4 | Ranks cheapest carrier first in `cheapest` mode | Carrier A (3000 MAD) before Carrier B (5000 MAD) | ✅ |
| 5 | Ranks fastest carrier first in `fastest` mode | Carrier B (1 day) before Carrier A (3 days) | ✅ |
| 6 | Skips carrier silently when no pricing tier matches weight | Returns empty results | ✅ |
| 7 | All identical signals → same score for all carriers | `results[0].score === results[1].score` | ✅ |

---

## Unit Tests — Zod Validation

**File:** `src/lib/__tests__/carriers-validation.test.ts`

| # | Test | Expected | Status |
|---|------|----------|--------|
| 8 | `CreatePricingSchema` accepts valid pricing row | Passes | ✅ |
| 9 | `CreatePricingSchema` rejects `weightMaxG <= weightMinG` | Validation error | ✅ |
| 10 | `CreatePricingSchema` rejects `deliveryDaysMax < deliveryDaysMin` | Validation error | ✅ |
| 11 | `CreateCarrierSchema` accepts optional `reliabilityScore` | Passes | ✅ |
| 12 | `CreateCarrierSchema` NaN `reliabilityScore` → treated as undefined | Passes (preprocess) | ✅ |

---

## Integration Tests — API Routes

**File:** `src/lib/__tests__/carriers-api.test.ts`

| # | Test | Expected | Status |
|---|------|----------|--------|
| 13 | `GET /api/carriers` returns 200 with carriers list | 200 + array | ✅ |
| 14 | `POST /api/carriers` returns 403 for non-admin | 403 | ✅ |
| 15 | `POST /api/carriers` returns 201 for admin | 201 + carrier object | ✅ |
| 16 | Carrier CRUD — zone + pricing routes | All return correct status codes | ✅ |

---

## Component Tests

**Files:** `src/components/__tests__/carrier-form.test.tsx`, `carrier-table.test.tsx`

| # | Test | Expected | Status |
|---|------|----------|--------|
| 17 | `CarrierForm` renders empty fields in create mode | Name + Slug + Logo + ReliabilityScore inputs visible | ✅ |
| 18 | `CarrierForm` shows validation error for empty name | Error message rendered | ✅ |
| 19 | `CarrierForm` calls `createCarrier` on valid submission | `mockCreate` called | ✅ |
| 20 | `CarrierForm` pre-fills form in edit mode | Values match carrier fixture | ✅ |
| 21 | `CarrierTable` renders carrier name and slug | Text present | ✅ |
| 22 | `CarrierTable` shows Active/Inactive badge | Badge renders correctly | ✅ |
| 23 | `CarrierTable` shows empty state | "No carriers yet" visible | ✅ |

---

## Smoke Tests — Manual (2026-03-14)

| # | Step | Expected | Status |
|---|------|----------|--------|
| 24 | Navigate to `/compare` as authenticated user | Page loads with form | ✅ |
| 25 | Type "Casablanca" → select from Google Places autocomplete | "Recognized: Casablanca" appears under input | ✅ |
| 26 | Type "Marrakech" → select from Google Places autocomplete | "Recognized: Marrakech" appears under input | ✅ |
| 27 | Fill weight=500, COD=0, mode=Balanced → click Compare | 5 carrier result cards appear, ranked by score | ✅ |
| 28 | "Best Match" badge on first card | Badge visible on top result | ✅ |
| 29 | Click **Price** sort | Cards reorder cheapest first, no page reload | ✅ |
| 30 | Click **Speed** sort | Cards reorder fewest days first | ✅ |
| 31 | Click **Score** sort | Cards return to score ranking | ✅ |
| 32 | "Book Now" button is disabled | Button greyed out, no navigation | ✅ |
| 33 | Sign in as admin → edit carrier → Reliability Score field visible | Field pre-filled with 80 | ✅ |
| 34 | Change reliability score → re-run comparison | Ranking updated to reflect new score | ✅ |

---

## Test Run Summary

| Suite | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Unit — comparison service | 7 | 7 | 0 |
| Unit — Zod validation | 26 | 26 | 0 |
| Unit — carriers service | 18 | 18 | 0 |
| Integration — API routes | 18 | 18 | 0 |
| Component tests | 9 | 9 | 0 |
| Smoke tests (manual) | 11 | 11 | 0 |
| **Total** | **78** | **78** | **0** |

**All tests passing: ✅**
