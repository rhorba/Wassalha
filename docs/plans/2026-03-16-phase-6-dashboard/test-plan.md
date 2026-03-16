# Phase 6 — Dashboard + Analytics: Test Plan

## Unit Tests

### 1. analytics service — getAnalyticsSummary
**File:** `src/lib/services/__tests__/analytics.test.ts`
- Returns zero counts + 0 MAD for empty dataset
- Computes successRate as (delivered / total) × 100, rounded
- Converts centimes to MAD correctly (÷ 100)
- Returns pipeline null for retailer role
- Returns pipeline object for admin role

### 2. analytics service — getAnalyticsCharts
**File:** `src/lib/services/__tests__/analytics.test.ts`
- Returns empty arrays when no shipments in range
- Carrier breakdown groups by carrier name
- Converts spend centimes to MAD

### 3. commission service (toMad helper via analytics)
**File:** `src/lib/services/__tests__/analytics.test.ts`
- 0 centimes → 0 MAD
- 123450 centimes → 1234.50 MAD
- null centimes → 0 MAD

### 4. billing service — createRetailerInvoice guards
**File:** `src/lib/services/__tests__/billing.test.ts`
- Throws NO_PENDING_COMMISSIONS when no pending rows exist

## Component Tests

### 5. StatCard component
**File:** `src/components/__tests__/stat-card.test.tsx`
- Renders title and value
- Shows `—` when value is null/undefined
- Shows error state when error=true

### 6. KpiRow component
**File:** `src/components/__tests__/kpi-row.test.tsx`
- Renders 6 cards for retailer (no pipeline row)
- Renders 9 cards for admin (+ 3 pipeline cards)
- Formats MAD values correctly

## Integration Tests — API Routes

### 7. GET /api/analytics/summary
**File:** `src/app/api/analytics/__tests__/summary.test.ts`
- Returns 401 when unauthenticated
- Returns summary object with required fields when authenticated

### 8. GET /api/analytics/charts
**File:** `src/app/api/analytics/__tests__/charts.test.ts`
- Returns 401 when unauthenticated
- Returns timeSeries + carrierBreakdown arrays

### 9. GET /api/shipments/export
**File:** `src/app/api/shipments/__tests__/export.test.ts`
- Returns 401 when unauthenticated
- Returns CSV content-type header
- Returns headers-only CSV when no rows match

### 10. GET /api/commissions/export
**File:** `src/app/api/commissions/__tests__/export.test.ts`
- Returns 401 when unauthenticated
- Returns 403 for retailer role
- Returns CSV content-type header for admin

### 11. POST /api/billing/invoices
**File:** `src/app/api/billing/__tests__/invoices.test.ts`
- Returns 401 when unauthenticated
- Returns 403 for retailer role
- Returns 400 for missing userId in body

---

## Smoke Test Scenarios (Manual)

Run these manually in the browser after `pnpm dev`. Requires a logged-in retailer account and a separate admin account.

### Part 1 — Retailer Dashboard

**S1 — KPI cards load on /dashboard**
1. Sign in as a retailer with at least 1 completed shipment
2. Navigate to `/dashboard`
3. Expected: 6 stat cards visible — "Expéditions", "En cours", "Taux livraison", "Dépenses", "COD collecté", "Commission payée"
4. Expected: values match the shipment data in the DB (not all zeros unless no shipments)
5. Expected: pipeline row (3 admin cards) is NOT visible

**S2 — KPI cards show `—` for new retailer with 0 shipments**
1. Sign in as a brand new retailer (no shipments)
2. Navigate to `/dashboard`
3. Expected: all 6 cards show `—` (not `0` or errors)

**S3 — Admin sees pipeline row**
1. Sign in as admin
2. Navigate to `/dashboard`
3. Expected: 9 stat cards total — 6 retailer cards + 3 pipeline cards ("En attente", "Facturé", "Encaissé")

---

### Part 2 — Analytics Charts

**S4 — Charts page loads and renders tabs**
1. Navigate to `/analytics`
2. Expected: page loads with DateRangePicker showing last 3 months
3. Expected: 3 tabs visible — "Volume", "Dépenses", "Transporteurs"
4. Expected: "Volume" tab active by default showing a bar chart (or empty state message if no data)

**S5 — Date range filter updates charts**
1. On `/analytics`, open the DateRangePicker
2. Change the "Début" date to last month
3. Expected: chart data refetches (brief loading state), chart updates

**S6 — Tab switching works**
1. Click "Dépenses" tab
2. Expected: line chart with two lines (Dépenses + Commission) renders (or empty state)
3. Click "Transporteurs" tab
4. Expected: pie chart with carrier breakdown renders (or empty state)

**S7 — CSV export downloads correct file**
1. On `/analytics`, click "Exporter CSV"
2. Expected: browser downloads `wassalha-shipments-YYYY-MM-DD.csv`
3. Open the file — expected: CSV headers present, data rows match visible shipments

---

### Part 3 — Admin Billing

**S8 — /admin/billing redirects non-admin**
1. Sign in as a retailer
2. Navigate to `/admin/billing` directly
3. Expected: redirected to `/dashboard` (not a 403 error page)

**S9 — Admin billing page shows pipeline totals**
1. Sign in as admin
2. Navigate to `/admin/billing`
3. Expected: 3 pipeline stat cards visible with MAD values
4. Expected: "Revendeurs avec commissions en attente" table shows retailers with pending commissions

**S10 — "Générer facture" button disabled when 0 pending**
1. On `/admin/billing`, find a retailer row with 0 MAD pending
2. Expected: "Générer facture" button is disabled and shows tooltip "Aucune commission en attente" on hover

**S11 — Generate Stripe invoice (requires Stripe test keys)**
1. Set `STRIPE_SECRET_KEY=sk_test_...` in `.env.local`
2. On `/admin/billing`, click "Générer facture" for a retailer with pending commissions
3. Expected: toast "Facture envoyée" appears with "Voir" action button
4. Expected: the retailer row disappears from the pending table (commissions → invoiced)
5. Expected: invoice appears in "Historique des factures" table with status "Ouverte"
6. Check Stripe dashboard → Invoices: invoice should be visible and sent

**S12 — Commissions export (admin only)**
1. As admin, navigate to: `http://localhost:3000/api/commissions/export`
2. Expected: browser downloads `wassalha-commissions-YYYY-MM-DD.csv`
3. Open file — expected: columns include `retailer_email`, `status`, `stripe_invoice_id`

**S13 — Commissions export blocked for retailer**
1. Sign in as retailer
2. Navigate to: `http://localhost:3000/api/commissions/export`
3. Expected: HTTP 403 Forbidden response

---

### Part 4 — Edge Cases

**S14 — Analytics empty state (date range with no data)**
1. On `/analytics`, set date range to a period with no shipments (e.g. year 2020)
2. Expected: all chart tabs show "Aucune donnée pour cette période" message — no JS errors

**S15 — Stripe key not configured (graceful fallback)**
1. Remove `STRIPE_SECRET_KEY` from `.env.local`
2. Navigate to `/admin/billing` → "Historique des factures"
3. Expected: table shows "Aucune facture." (empty list) — not a 500 error

**S16 — Navigation links respect role**
1. Sign in as retailer — verify nav shows: Dashboard, Compare, Analytiques (no Facturation, no Carriers)
2. Sign in as admin — verify nav shows: Dashboard, Compare, Analytiques, Carriers, Facturation
