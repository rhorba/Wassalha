# Phase 6 — Dashboard + Analytics: Design

**Date:** 2026-03-16
**Status:** Design complete, ready for implementation planning

---

## Overview

Role-aware dashboard for two audiences rendered from a single route tree:
- **Retailers** — operational + financial KPIs, shipment history, analytics charts, CSV export
- **Admins** — all retailer data aggregated + commission billing pipeline + Stripe invoice generation

No new DB tables required except 2 new columns (migration `0005`).

---

## API Routes (4 new)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/analytics/summary` | retailer + admin | KPI card data |
| `GET` | `/api/analytics/charts` | retailer + admin | Time-series + carrier breakdown |
| `GET` | `/api/shipments/export` | retailer + admin | CSV download |
| `GET` | `/api/commissions/export` | admin only | CSV download |
| `POST` | `/api/billing/invoices` | admin only | Create Stripe invoice for a retailer |
| `GET` | `/api/billing/invoices` | admin only | List invoices with status |
| `POST` | `/api/webhooks/stripe` | Stripe | Mark commissions `paid` on `invoice.paid` |

---

## Schema Delta (migration 0005)

Two new columns — no new tables:

```ts
// users table
stripeCustomerId: text("stripe_customer_id")  // nullable, set on first invoice

// commissions table
stripeInvoiceId: text("stripe_invoice_id")    // nullable, set when invoiced
```

---

## Data Layer — Analytics Queries

Pure Drizzle aggregations. `GROUP BY` time buckets use raw SQL (complex aggregation exception per CLAUDE.md).

### Summary (KPI cards)

```ts
// Retailer-scoped (admin omits userId filter)
db.select({
  total:      sql<number>`count(*)::int`,
  active:     sql<number>`count(*) filter (where status in ('confirmed','picked_up','in_transit'))::int`,
  delivered:  sql<number>`count(*) filter (where status = 'delivered')::int`,
  totalSpend: sql<number>`sum(shipping_cost_mad)::int`,
  totalCod:   sql<number>`sum(cod_amount_mad) filter (where status = 'delivered')::int`,
}).from(shipments).where(eq(shipments.userId, userId))

// Commission totals (separate query, joined by shipmentId)
db.select({
  totalCommission: sql<number>`sum(total_commission_mad)::int`,
  pending:         sql<number>`sum(total_commission_mad) filter (where status = 'pending')::int`,
  invoiced:        sql<number>`sum(total_commission_mad) filter (where status = 'invoiced')::int`,
  paid:            sql<number>`sum(total_commission_mad) filter (where status = 'paid')::int`,
}).from(commissions)
```

All centimes values divided by 100 at the service layer before returning.

### Charts

```ts
// Volume + spend time-series (weekly buckets)
sql`
  select date_trunc('week', created_at) as week,
         count(*)::int as shipments,
         sum(shipping_cost_mad)::int as spend,
         sum(c.total_commission_mad)::int as commission
  from shipments s
  left join commissions c on c.shipment_id = s.id
  where s.user_id = ${userId}
    and s.created_at >= ${from} and s.created_at <= ${to}
  group by 1
  order by 1
`

// Carrier breakdown (pie)
db.select({
  carrierName: carriers.name,
  count:       sql<number>`count(*)::int`,
  spend:       sql<number>`sum(s.shipping_cost_mad)::int`,
}).from(shipments).leftJoin(carriers, ...).groupBy(carriers.id)
```

---

## Component Structure

### `/dashboard` (RSC — fetches summary, passes to client panels)

```
DashboardPage (RSC)
├── KpiRow (Client)
│   ├── StatCard: Total Shipments
│   ├── StatCard: Active (in-transit)
│   ├── StatCard: Success Rate  (delivered / total, formatted as %)
│   ├── StatCard: Total Spend   (MAD)
│   ├── StatCard: COD Collected (MAD, delivered only)
│   └── StatCard: Commission Paid (MAD)
├── [admin only] CommissionPipelineRow (Client)
│   └── StatCard × 3: Pending | Invoiced | Paid (MAD totals)
└── RecentShipmentsTable (existing shipments-table.tsx ✅)
```

### `/analytics` (RSC — chart data, separate page)

```
AnalyticsPage (RSC)
└── ChartPanel (Client — TanStack Query, refetches on filter change)
    ├── DateRangePicker   (shadcn Popover + Calendar)
    ├── Tabs: Volume | Spend & Commission | Carrier Breakdown
    │   ├── Volume tab:            BarChart (shipments/week)
    │   ├── Spend & Commission tab: LineChart (spend + commission/week, dual axis)
    │   └── Carrier Breakdown tab:  PieChart (count + spend by carrier)
    └── ExportButton → GET /api/shipments/export (with active filters)
```

### `/admin/billing` (RSC — admin only, gated in middleware)

```
BillingPage (RSC)
├── BillingOverview (3 StatCards: Pending | Invoiced | Paid totals)
├── RetailerBillingTable
│   └── Per row: retailer email, pending commission total, "Generate Invoice" button
│       → POST /api/billing/invoices { userId }
│       → success: toast + row updates to "invoiced"
└── InvoiceHistoryTable
    └── Per row: retailer, date, amount, status badge, "View PDF" link (Stripe hosted)
```

---

## Stripe Billing Flow

```
Admin → "Generate Invoice" for retailer X
  → POST /api/billing/invoices { userId }
  → service:
      1. Fetch all commissions WHERE userId = X AND status = 'pending'
      2. Guard: if none → 400 "No pending commissions"
      3. Upsert Stripe Customer (users.stripeCustomerId)
      4. Create Stripe Invoice with line items:
         - "Shipping commission – {trackingNumber}" → shippingFeeAmountMad / 100 MAD
         - "COD commission – {trackingNumber}"      → codFeeAmountMad / 100 MAD
      5. Finalize + auto-send (Stripe emails PDF to retailer)
      6. Mark commissions.status → 'invoiced', store stripeInvoiceId
  → Return { invoiceId, invoiceUrl }

Stripe webhook → POST /api/webhooks/stripe
  → invoice.paid event
  → Mark all commissions with stripeInvoiceId → status = 'paid'
```

**Idempotency guard:** Check `stripeInvoiceId IS NULL` before creating. Safe to retry on Stripe failure — commissions stay `pending`.

---

## CSV Export

Streaming response — no temp files, no memory load:

```ts
// GET /api/shipments/export?from=&to=&status=&carrierId=
// Columns: id, date, recipient, city, carrier, status,
//          shipping_cost_mad, cod_amount_mad, commission_total_mad, mode
// Filename: wassalha-shipments-YYYY-MM-DD.csv

// GET /api/commissions/export (admin only)
// Columns: id, date, retailer_email, shipment_id,
//          shipping_fee_mad, cod_fee_mad, total_mad, status, stripe_invoice_id
// Filename: wassalha-commissions-YYYY-MM-DD.csv
```

Both respect active filters. Empty result → CSV with headers only (not 404).

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Retailer has 0 shipments | StatCards show `—`, chart renders empty axes |
| KPI fetch error | Each StatCard fails independently — not a full-page error |
| Stripe API down | 502, toast error, commissions stay `pending` (safe to retry) |
| Generate invoice — 0 pending | Button disabled, tooltip "No pending commissions" |
| Admin CSV export — 0 rows | Returns headers-only CSV, not 404 |
| Recharts SSR | Wrapped in `dynamic(..., { ssr: false })` — avoids hydration mismatch |

---

## Currency Display

All internal values in centimes (integers). Display format:

```ts
// 123450 centimes → "1 234,50 MAD"
(value / 100).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD' })
```

---

## Navigation Updates

Add to `(dashboard)/layout.tsx`:

```tsx
<Link href="/analytics">Analytics</Link>
{isAdmin && <Link href="/admin/billing">Billing</Link>}
```

---

## Success Criteria

- Retailer sees their KPIs + charts within 1s (server-fetched RSC)
- Admin can generate a Stripe invoice in < 3 clicks
- CSV exports stream without timeout for up to 10k rows
- 0 regressions on existing 107 tests
