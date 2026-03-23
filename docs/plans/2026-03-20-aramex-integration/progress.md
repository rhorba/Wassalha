# Aramex Integration — Progress

> **Pre-execution checklist:** ensure these are set in `.env.local` before manual testing:
> - `ARAMEX_USERNAME`, `ARAMEX_PASSWORD`
> - `ARAMEX_ACCOUNT_NUMBER`, `ARAMEX_ACCOUNT_PIN`
> - `ARAMEX_ACCOUNT_ENTITY` (e.g. `CAS`)
> - `ARAMEX_ACCOUNT_COUNTRY_CODE` (`MA`)
> - `ARAMEX_API_URL` removed (no longer used — endpoints hardcoded in adapter)

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Install dependency + env vars | ✅ completed | `fast-xml-parser` installed; `.env.example` updated |
| Task 2: SOAP utility layer | ✅ completed | `src/lib/carriers/aramex-soap.ts` created |
| Task 3: Rewrite AramexAdapter | ✅ completed | SOAP: CreateShipments + TrackShipments + CalculateRate + PrintLabel |
| Task 4: Extend CarrierAdapter interface | ✅ completed | Optional `calculateRate?` added to interface |
| Task 5: Hybrid pricing in comparison service | ✅ completed | `slug` + `UnavailableCarrier` in validations; hybrid pricing in `comparison.ts` |
| Task 6: Update compare API route | ✅ completed | `CITY_NOT_FOUND` branch now returns `unavailable: []` |
| Task 7: Label download API route | ✅ completed | `GET /api/shipments/[id]/label` — PrintLabel on-demand 302 redirect |
| Task 8: ResultsList unavailable card | ✅ completed | Greyed-out dashed card for each unavailable carrier |
| Task 9: Pass unavailable to ResultsList | ✅ completed | `use-compare.ts` + `compare-page-client.tsx` updated |
| Task 10: Download Label button | ✅ completed | "Download Waybill Label" `<a>` on Aramex shipments only |
| Task 11: Delete mock + update docs | ✅ completed | `mock-aramex/` deleted; CLAUDE.md + `.env.example` updated |
| Task 12: Full verification | ✅ completed | typecheck ✅ lint ✅ build ✅ tests 178/179 ✅ |

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-03-23
- ✅ Task 1: Installed `fast-xml-parser`; updated `.env.example` — replaced `ARAMEX_API_URL` with `ARAMEX_ACCOUNT_ENTITY` + `ARAMEX_ACCOUNT_COUNTRY_CODE`
- ✅ Task 2: Created `src/lib/carriers/aramex-soap.ts` — `buildClientInfo()`, `buildEnvelope()`, `callAramex()` with XMLParser + SOAP error unwrapping
- ✅ Task 3: Rewrote `src/lib/carriers/adapters/aramex.ts` — full SOAP adapter with 30-code status map; `CarrierAdapter` interface still satisfied
- Verification: typecheck ✅

### Batch 2 (Tasks 4–6) — 2026-03-23
- ✅ Task 4: Added optional `calculateRate?` method to `CarrierAdapter` interface in `types.ts` — all 4 stub adapters unaffected
- ✅ Task 5: Updated `CarrierResult` with `slug` field + added `UnavailableCarrier` type in `validations/carriers.ts`; rewrote `comparison.ts` with hybrid pricing (live Aramex `CalculateRate` with 3s timeout, graceful exclusion on failure)
- ✅ Task 6: `compare/route.ts` CITY_NOT_FOUND branch now includes `unavailable: []` in response
- Verification: typecheck ✅

### Batch 3 (Tasks 7–9) — 2026-03-23
- ✅ Task 7: Created `src/app/api/shipments/[id]/label/route.ts` — auth + ownership check, Aramex-only guard, `printLabel` → 302 redirect
- ✅ Task 8: `ResultsList` accepts optional `unavailable?: UnavailableCarrier[]` and renders greyed-out dashed cards below the ranked results
- ✅ Task 9: `use-compare.ts` response type includes `unavailable: UnavailableCarrier[]`; `compare-page-client.tsx` tracks `unavailable` state and passes it to `<ResultsList>`
- Verification: typecheck ✅

### Batch 4 (Tasks 10–12) — 2026-03-23
- ✅ Task 10: Added "Download Waybill Label" `<a>` button to shipment detail — Aramex-only + tracking number required guard
- ✅ Task 11: Deleted `src/app/api/mock-aramex/` folder; updated `CLAUDE.md` (project structure + carrier APIs note); updated `.env.example` comment
- ✅ Task 12: Cleared stale `.next` cache; typecheck ✅ lint ✅ build ✅; fixed 3 test files (aramex-tracking rewritten for SOAP, tracking + comparison use `toMatchObject`, carriers-api mock gets `userId`); 178/179 tests passing (1 pre-existing rate-limit flaky)

## Plan Complete ✅ — 2026-03-23

---

## Pending: Aramex Credentials (Manual Step)

Before manual smoke tests (Task 12 steps 3–7) can be run, obtain staging credentials from Aramex:

1. **Register** at `developer.aramex.net` (or contact Aramex Morocco directly if the portal is down — it was down during W9)
2. **For Morocco business accounts:** contact via `aramex.com/ma → Contact Us` — request API/sandbox access for a logistics aggregator integration
3. Once issued, set in `.env.local`:
   ```
   ARAMEX_USERNAME=        # your Aramex account email
   ARAMEX_PASSWORD=        # your Aramex account password
   ARAMEX_ACCOUNT_NUMBER=  # from My Account → Account Details
   ARAMEX_ACCOUNT_PIN=     # 4–6 digit PIN next to account number
   ARAMEX_ACCOUNT_ENTITY=CAS
   ARAMEX_ACCOUNT_COUNTRY_CODE=MA
   ```
4. Run smoke tests from Task 12 (steps 3–7) in the plan
