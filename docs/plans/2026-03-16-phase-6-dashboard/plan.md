# Phase 6 — Dashboard + Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Build a role-aware retailer dashboard (KPIs, charts, CSV export) and admin billing dashboard (Stripe invoice generation, commission pipeline) on top of the existing shipments + commissions data.

**Architecture:** RSC pages server-fetch aggregate data and pass it to Client Components. TanStack Query handles client-side refetching for chart filters. Stripe SDK runs server-side only (billing service layer). No new DB tables — 2 new columns via migration 0005.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W6 — Dashboard + Analytics

---

## Part 1 — Schema + Migration

### Task 1: Add Stripe columns + generate migration 0005

**Files:**
- Modify: `src/lib/db/schema/users.ts`
- Modify: `src/lib/db/schema/shipments.ts`

**Step 1: Add `stripeCustomerId` to users table**

In `src/lib/db/schema/users.ts`, add one column inside the `pgTable` call:

```ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["retailer", "admin"]);

export const users = pgTable("users", {
  id:               text("id").primaryKey(),
  email:            text("email").notNull().unique(),
  name:             text("name"),
  role:             roleEnum("role").notNull().default("retailer"),
  stripeCustomerId: text("stripe_customer_id"),          // ← new
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**Step 2: Add `stripeInvoiceId` to commissions table**

In `src/lib/db/schema/shipments.ts`, add one column inside the `commissions` pgTable:

```ts
export const commissions = pgTable(
  "commissions",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    shipmentId:           uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "restrict" }),
    shippingFeePercent:   numeric("shipping_fee_percent", { precision: 5, scale: 2 }).notNull(),
    shippingFeeAmountMad: integer("shipping_fee_amount_mad").notNull(),
    codFeePercent:        numeric("cod_fee_percent", { precision: 5, scale: 2 }).notNull(),
    codFeeAmountMad:      integer("cod_fee_amount_mad").notNull(),
    totalCommissionMad:   integer("total_commission_mad").notNull(),
    status:               commissionStatusEnum("status").notNull().default("pending"),
    stripeInvoiceId:      text("stripe_invoice_id"),     // ← new
    createdAt:            timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("commissions_shipment_id_unique").on(t.shipmentId)],
);
```

**Step 3: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file `src/lib/db/migrations/0005_*.sql` with two `ALTER TABLE ADD COLUMN` statements.

---

## Part 2 — Analytics Service + API Routes

### Task 2: Analytics service — summary + charts

**Files:**
- Create: `src/lib/services/analytics.ts`

**Step 1: Create the analytics service**

```ts
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, commissions, carriers } from "@/lib/db/schema";

/** Convert centimes to MAD (2 decimal places). */
function toMad(centimes: number | null): number {
  return Math.round(((centimes ?? 0) / 100) * 100) / 100;
}

export interface AnalyticsSummary {
  totalShipments:    number;
  activeShipments:   number;
  deliveredCount:    number;
  successRate:       number; // 0–100
  totalSpendMad:     number;
  totalCodMad:       number;
  commissionPaidMad: number;
  // admin only (null for retailers)
  pipeline: {
    pendingMad:  number;
    invoicedMad: number;
    paidMad:     number;
  } | null;
}

export async function getAnalyticsSummary(
  userId: string,
  role: "retailer" | "admin",
): Promise<AnalyticsSummary> {
  const where = role === "admin" ? undefined : eq(shipments.userId, userId);

  const [shipRow] = await db
    .select({
      total:      sql<number>`count(*)::int`,
      active:     sql<number>`count(*) filter (where status in ('confirmed','picked_up','in_transit'))::int`,
      delivered:  sql<number>`count(*) filter (where status = 'delivered')::int`,
      totalSpend: sql<number>`coalesce(sum(shipping_cost_mad), 0)::int`,
      totalCod:   sql<number>`coalesce(sum(cod_amount_mad) filter (where status = 'delivered'), 0)::int`,
    })
    .from(shipments)
    .where(where);

  // Commission totals scoped to same shipments
  const commWhere = role === "admin"
    ? undefined
    : eq(shipments.userId, userId);

  const [commRow] = await db
    .select({
      paid:     sql<number>`coalesce(sum(c.total_commission_mad) filter (where c.status = 'paid'), 0)::int`,
      pending:  sql<number>`coalesce(sum(c.total_commission_mad) filter (where c.status = 'pending'), 0)::int`,
      invoiced: sql<number>`coalesce(sum(c.total_commission_mad) filter (where c.status = 'invoiced'), 0)::int`,
    })
    .from(commissions)
    .leftJoin(shipments, eq(commissions.shipmentId, shipments.id))
    .where(commWhere);

  const total     = shipRow.total ?? 0;
  const delivered = shipRow.delivered ?? 0;

  return {
    totalShipments:    total,
    activeShipments:   shipRow.active ?? 0,
    deliveredCount:    delivered,
    successRate:       total > 0 ? Math.round((delivered / total) * 100) : 0,
    totalSpendMad:     toMad(shipRow.totalSpend),
    totalCodMad:       toMad(shipRow.totalCod),
    commissionPaidMad: toMad(commRow.paid),
    pipeline: role === "admin"
      ? {
          pendingMad:  toMad(commRow.pending),
          invoicedMad: toMad(commRow.invoiced),
          paidMad:     toMad(commRow.paid),
        }
      : null,
  };
}

export interface ChartWeekPoint {
  week:       string; // ISO date string
  shipments:  number;
  spendMad:   number;
  commissionMad: number;
}

export interface CarrierBreakdownPoint {
  carrier: string;
  count:   number;
  spendMad: number;
}

export interface AnalyticsCharts {
  timeSeries:       ChartWeekPoint[];
  carrierBreakdown: CarrierBreakdownPoint[];
}

export async function getAnalyticsCharts(
  userId: string,
  role: "retailer" | "admin",
  from: Date,
  to: Date,
): Promise<AnalyticsCharts> {
  const userFilter = role === "admin" ? sql`1=1` : sql`s.user_id = ${userId}`;

  // Weekly time-series (raw SQL — complex GROUP BY time bucket)
  const timeRows = await db.execute<{
    week: string;
    shipments: number;
    spend: number;
    commission: number;
  }>(sql`
    select
      date_trunc('week', s.created_at)::text as week,
      count(*)::int                           as shipments,
      coalesce(sum(s.shipping_cost_mad), 0)::int as spend,
      coalesce(sum(c.total_commission_mad), 0)::int as commission
    from shipments s
    left join commissions c on c.shipment_id = s.id
    where ${userFilter}
      and s.created_at >= ${from}
      and s.created_at <= ${to}
    group by 1
    order by 1
  `);

  // Carrier breakdown
  const carrierWhere = role === "admin"
    ? undefined
    : eq(shipments.userId, userId);

  const carrierRows = await db
    .select({
      carrier: carriers.name,
      count:   sql<number>`count(*)::int`,
      spend:   sql<number>`coalesce(sum(s.shipping_cost_mad), 0)::int`,
    })
    .from(shipments)
    .leftJoin(carriers, eq(shipments.carrierId, carriers.id))
    .where(
      and(
        carrierWhere,
        gte(shipments.createdAt, from),
        lte(shipments.createdAt, to),
      ),
    )
    .groupBy(carriers.id, carriers.name);

  return {
    timeSeries: timeRows.rows.map((r) => ({
      week:          r.week,
      shipments:     r.shipments,
      spendMad:      toMad(r.spend),
      commissionMad: toMad(r.commission),
    })),
    carrierBreakdown: carrierRows.map((r) => ({
      carrier:  r.carrier ?? "Unknown",
      count:    r.count,
      spendMad: toMad(r.spend),
    })),
  };
}
```

---

### Task 3: GET /api/analytics/summary route

**Files:**
- Create: `src/app/api/analytics/summary/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/services/analytics";

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const summary = await getAnalyticsSummary(userId, role);
  return NextResponse.json(summary);
}
```

---

### Task 4: GET /api/analytics/charts route

**Files:**
- Create: `src/app/api/analytics/charts/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAnalyticsCharts } from "@/lib/services/analytics";

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const { searchParams } = new URL(req.url);
  const now  = new Date();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(now.getFullYear(), now.getMonth() - 2, 1); // default: last 3 months
  const to   = searchParams.get("to") ? new Date(searchParams.get("to")!) : now;

  const charts = await getAnalyticsCharts(userId, role, from, to);
  return NextResponse.json(charts);
}
```

---

## Part 3 — CSV Export

### Task 5: GET /api/shipments/export

**Files:**
- Create: `src/app/api/shipments/export/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, commissions, carriers } from "@/lib/db/schema";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines   = rows.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const { searchParams } = new URL(req.url);
  const fromParam     = searchParams.get("from");
  const toParam       = searchParams.get("to");
  const statusParam   = searchParams.get("status");
  const carrierParam  = searchParams.get("carrierId");

  const filters = [
    role === "retailer" ? eq(shipments.userId, userId) : undefined,
    fromParam  ? gte(shipments.createdAt, new Date(fromParam)) : undefined,
    toParam    ? lte(shipments.createdAt, new Date(toParam))   : undefined,
    statusParam  ? eq(shipments.status, statusParam as never)  : undefined,
    carrierParam ? eq(shipments.carrierId, carrierParam)       : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id:                    shipments.id,
      date:                  shipments.createdAt,
      recipient:             shipments.recipientName,
      city:                  shipments.recipientCity,
      carrier:               carriers.name,
      status:                shipments.status,
      shipping_cost_mad:     shipments.shippingCostMad,
      cod_amount_mad:        shipments.codAmountMad,
      commission_total_mad:  commissions.totalCommissionMad,
      mode:                  shipments.mode,
    })
    .from(shipments)
    .leftJoin(carriers,    eq(shipments.carrierId,   carriers.id))
    .leftJoin(commissions, eq(commissions.shipmentId, shipments.id))
    .where(and(...filters));

  const date     = new Date().toISOString().slice(0, 10);
  const filename = `wassalha-shipments-${date}.csv`;
  const csv      = rows.length > 0
    ? toCsv(rows as Record<string, unknown>[])
    : "id,date,recipient,city,carrier,status,shipping_cost_mad,cod_amount_mad,commission_total_mad,mode";

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

---

### Task 6: GET /api/commissions/export (admin only)

**Files:**
- Create: `src/app/api/commissions/export/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, commissions, users } from "@/lib/db/schema";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines   = rows.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const fromParam   = searchParams.get("from");
  const toParam     = searchParams.get("to");
  const statusParam = searchParams.get("status");

  const filters = [
    fromParam   ? gte(commissions.createdAt, new Date(fromParam))                      : undefined,
    toParam     ? lte(commissions.createdAt, new Date(toParam))                        : undefined,
    statusParam ? eq(commissions.status, statusParam as "pending"|"invoiced"|"paid")   : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id:                commissions.id,
      date:              commissions.createdAt,
      retailer_email:    users.email,
      shipment_id:       commissions.shipmentId,
      shipping_fee_mad:  commissions.shippingFeeAmountMad,
      cod_fee_mad:       commissions.codFeeAmountMad,
      total_mad:         commissions.totalCommissionMad,
      status:            commissions.status,
      stripe_invoice_id: commissions.stripeInvoiceId,
    })
    .from(commissions)
    .leftJoin(shipments, eq(commissions.shipmentId, shipments.id))
    .leftJoin(users,     eq(shipments.userId, users.id))
    .where(and(...filters));

  const date     = new Date().toISOString().slice(0, 10);
  const filename = `wassalha-commissions-${date}.csv`;
  const csv      = rows.length > 0
    ? toCsv(rows as Record<string, unknown>[])
    : "id,date,retailer_email,shipment_id,shipping_fee_mad,cod_fee_mad,total_mad,status,stripe_invoice_id";

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

---

## Part 4 — Dashboard UI

### Task 7: StatCard component + KpiRow

**Files:**
- Create: `src/components/dashboard/stat-card.tsx`
- Create: `src/components/dashboard/kpi-row.tsx`

**Step 1: StatCard**

```tsx
// src/components/dashboard/stat-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title:       string;
  value:       string | number | null | undefined;
  description?: string;
  error?:      boolean;
}

export function StatCard({ title, value, description, error }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {error ? (
            <span className="text-destructive text-sm">Erreur</span>
          ) : value == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            value
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: KpiRow**

```tsx
// src/components/dashboard/kpi-row.tsx
"use client";

import { StatCard } from "./stat-card";
import type { AnalyticsSummary } from "@/lib/services/analytics";

function formatMad(value: number): string {
  return (value).toLocaleString("fr-MA", {
    style:    "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
  });
}

interface KpiRowProps {
  summary: AnalyticsSummary;
  isAdmin: boolean;
}

export function KpiRow({ summary, isAdmin }: KpiRowProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Expéditions"     value={summary.totalShipments} />
        <StatCard title="En cours"        value={summary.activeShipments} />
        <StatCard title="Taux livraison"  value={`${summary.successRate}%`} />
        <StatCard title="Dépenses"        value={formatMad(summary.totalSpendMad)} />
        <StatCard title="COD collecté"    value={formatMad(summary.totalCodMad)} />
        <StatCard title="Commission payée" value={formatMad(summary.commissionPaidMad)} />
      </div>

      {isAdmin && summary.pipeline && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Commission en attente"  value={formatMad(summary.pipeline.pendingMad)}  description="À facturer" />
          <StatCard title="Commission facturée"    value={formatMad(summary.pipeline.invoicedMad)} description="En attente paiement" />
          <StatCard title="Commission encaissée"   value={formatMad(summary.pipeline.paidMad)}     description="Reçue" />
        </div>
      )}
    </div>
  );
}
```

---

### Task 8: useAnalyticsSummary TanStack Query hook

**Files:**
- Create: `src/hooks/use-analytics-summary.ts`

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsSummary } from "@/lib/services/analytics";

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary"],
    queryFn:  async () => {
      const res = await fetch("/api/analytics/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json() as Promise<AnalyticsSummary>;
    },
    staleTime: 60_000, // 1 minute
  });
}
```

---

### Task 9: Upgrade /dashboard/page.tsx

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

Replace the placeholder with a real RSC that server-fetches summary and renders the KPI row:

```tsx
import { auth } from "@clerk/nextjs/server";
import { getAnalyticsSummary } from "@/lib/services/analytics";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ShipmentsTable } from "@/components/shipments/shipments-table";

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const summary = await getAnalyticsSummary(userId, role as "retailer" | "admin");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      <KpiRow summary={summary} isAdmin={role === "admin"} />

      <div>
        <h2 className="text-lg font-semibold mb-4">Expéditions récentes</h2>
        <ShipmentsTable />
      </div>
    </div>
  );
}
```

---

## Part 5 — Analytics Charts Page

### Task 10: Install Recharts + shadcn calendar/popover

**Step 1: Install Recharts**

```bash
pnpm add recharts
pnpm add -D @types/recharts
```

**Step 2: Add shadcn calendar and popover components**

```bash
pnpm dlx shadcn@latest add calendar
pnpm dlx shadcn@latest add popover
pnpm dlx shadcn@latest add tabs
```

---

### Task 11: useAnalyticsCharts TanStack Query hook

**Files:**
- Create: `src/hooks/use-analytics-charts.ts`

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsCharts } from "@/lib/services/analytics";

export function useAnalyticsCharts(from: Date, to: Date) {
  return useQuery<AnalyticsCharts>({
    queryKey: ["analytics", "charts", from.toISOString(), to.toISOString()],
    queryFn:  async () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to:   to.toISOString(),
      });
      const res = await fetch(`/api/analytics/charts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch charts");
      return res.json() as Promise<AnalyticsCharts>;
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}
```

---

### Task 12: ChartPanel Client component

**Files:**
- Create: `src/components/analytics/chart-panel.tsx`

```tsx
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAnalyticsCharts } from "@/hooks/use-analytics-charts";
import { DateRangePicker } from "./date-range-picker";

// SSR-safe Recharts imports
const BarChart      = dynamic(() => import("./charts/volume-chart"),   { ssr: false });
const LineChart     = dynamic(() => import("./charts/spend-chart"),    { ssr: false });
const PieChart      = dynamic(() => import("./charts/carrier-chart"),  { ssr: false });

export function ChartPanel() {
  const now     = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  const [to,   setTo]   = useState(now);

  const { data, isPending, isError } = useAnalyticsCharts(from, to);

  function handleExport() {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to:   to.toISOString(),
    });
    window.location.href = `/api/shipments/export?${params}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <Button variant="outline" size="sm" onClick={handleExport}>
          Exporter CSV
        </Button>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Chargement...</p>}
      {isError   && <p className="text-sm text-destructive">Erreur de chargement</p>}

      {data && (
        <Tabs defaultValue="volume">
          <TabsList>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="spend">Dépenses</TabsTrigger>
            <TabsTrigger value="carriers">Transporteurs</TabsTrigger>
          </TabsList>
          <TabsContent value="volume">
            <BarChart data={data.timeSeries} />
          </TabsContent>
          <TabsContent value="spend">
            <LineChart data={data.timeSeries} />
          </TabsContent>
          <TabsContent value="carriers">
            <PieChart data={data.carrierBreakdown} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

---

### Task 13: Chart sub-components (VolumeChart, SpendChart, CarrierChart)

**Files:**
- Create: `src/components/analytics/charts/volume-chart.tsx`
- Create: `src/components/analytics/charts/spend-chart.tsx`
- Create: `src/components/analytics/charts/carrier-chart.tsx`
- Create: `src/components/analytics/date-range-picker.tsx`

**Step 1: VolumeChart**

```tsx
// src/components/analytics/charts/volume-chart.tsx
"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { ChartWeekPoint } from "@/lib/services/analytics";

export default function VolumeChart({ data }: { data: ChartWeekPoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tickFormatter={(v: string) => v.slice(0, 10)} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="shipments" fill="#2563eb" name="Expéditions" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      Aucune donnée pour cette période
    </div>
  );
}
```

**Step 2: SpendChart**

```tsx
// src/components/analytics/charts/spend-chart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ChartWeekPoint } from "@/lib/services/analytics";

export default function SpendChart({ data }: { data: ChartWeekPoint[] }) {
  if (data.length === 0) return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      Aucune donnée pour cette période
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tickFormatter={(v: string) => v.slice(0, 10)} />
        <YAxis yAxisId="left"  />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip formatter={(v: number) => `${v.toFixed(2)} MAD`} />
        <Legend />
        <Line yAxisId="left"  type="monotone" dataKey="spendMad"      stroke="#2563eb" name="Dépenses (MAD)" />
        <Line yAxisId="right" type="monotone" dataKey="commissionMad" stroke="#16a34a" name="Commission (MAD)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Step 3: CarrierChart**

```tsx
// src/components/analytics/charts/carrier-chart.tsx
"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CarrierBreakdownPoint } from "@/lib/services/analytics";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed"];

export default function CarrierChart({ data }: { data: CarrierBreakdownPoint[] }) {
  if (data.length === 0) return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      Aucune donnée pour cette période
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="carrier" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `${v} expéditions`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

**Step 4: DateRangePicker**

```tsx
// src/components/analytics/date-range-picker.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateRangePickerProps {
  from:         Date;
  to:           Date;
  onFromChange: (d: Date) => void;
  onToChange:   (d: Date) => void;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {format(from, "dd/MM/yyyy")} – {format(to, "dd/MM/yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-2 p-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Début</p>
            <Calendar mode="single" selected={from} onSelect={(d) => d && onFromChange(d)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Fin</p>
            <Calendar mode="single" selected={to} onSelect={(d) => d && onToChange(d)} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

### Task 14: /analytics/page.tsx RSC

**Files:**
- Create: `src/app/(dashboard)/analytics/page.tsx`

```tsx
import { ChartPanel } from "@/components/analytics/chart-panel";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Analytiques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Volume, dépenses et répartition par transporteur
        </p>
      </div>
      <ChartPanel />
    </div>
  );
}
```

---

## Part 6 — Stripe Billing

### Task 15: Install Stripe SDK + add env vars

**Step 1: Install**

```bash
pnpm add stripe
```

**Step 2: Add to `.env.example`**

```bash
# Stripe (Phase 6 — commission billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Step 3: Create Stripe singleton**

File: `src/lib/stripe.ts`

```ts
import Stripe from "stripe";

// Lazy singleton — only initialized when first called
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2025-01-27.acacia" });
  }
  return _stripe;
}
```

---

### Task 16: Billing service

**Files:**
- Create: `src/lib/services/billing.ts`

```ts
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { commissions, shipments, users } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";

export interface RetailerBillingRow {
  userId:         string;
  email:          string;
  name:           string | null;
  pendingCount:   number;
  pendingTotalMad: number; // MAD (not centimes)
}

/** List all retailers who have pending commissions. */
export async function getRetailersBillingOverview(): Promise<RetailerBillingRow[]> {
  const rows = await db
    .select({
      userId:       users.id,
      email:        users.email,
      name:         users.name,
      pendingCount: db.$count(commissions, eq(commissions.status, "pending")),
    })
    .from(users)
    .innerJoin(shipments,   eq(shipments.userId,       users.id))
    .innerJoin(commissions, and(
      eq(commissions.shipmentId, shipments.id),
      eq(commissions.status,     "pending"),
      isNull(commissions.stripeInvoiceId),
    ))
    .groupBy(users.id, users.email, users.name);

  // Get totals per user
  const result: RetailerBillingRow[] = [];
  for (const row of rows) {
    const [totRow] = await db
      .select({ total: db.$count(commissions) })
      .from(commissions)
      .innerJoin(shipments, eq(commissions.shipmentId, shipments.id))
      .where(and(
        eq(shipments.userId,       row.userId),
        eq(commissions.status,     "pending"),
        isNull(commissions.stripeInvoiceId),
      ));

    result.push({
      ...row,
      pendingTotalMad: 0, // will be filled below
    });

    void totRow; // suppress unused warning — see next block
  }

  // Simpler re-query for totals (Drizzle doesn't support mixed agg + group cleanly here)
  const totals = await db
    .select({
      userId: shipments.userId,
      total:  db.$count(commissions),
    })
    .from(commissions)
    .innerJoin(shipments, eq(commissions.shipmentId, shipments.id))
    .where(and(
      eq(commissions.status, "pending"),
      isNull(commissions.stripeInvoiceId),
    ))
    .groupBy(shipments.userId);

  const totalMap = Object.fromEntries(totals.map((t) => [t.userId, t.total]));

  return result.map((r) => ({
    ...r,
    pendingTotalMad: (totalMap[r.userId] ?? 0),
  }));
}

export interface InvoiceResult {
  invoiceId:  string;
  invoiceUrl: string;
}

/** Create a Stripe invoice for all pending commissions of a retailer. */
export async function createRetailerInvoice(
  targetUserId: string,
): Promise<InvoiceResult> {
  const stripe = getStripe();

  // 1. Load pending commissions with shipment data
  const pendingRows = await db
    .select({
      commissionId:    commissions.id,
      shipmentId:      commissions.shipmentId,
      trackingNumber:  shipments.carrierTrackingNumber,
      shippingFee:     commissions.shippingFeeAmountMad,
      codFee:          commissions.codFeeAmountMad,
      stripeInvoiceId: commissions.stripeInvoiceId,
    })
    .from(commissions)
    .innerJoin(shipments, eq(commissions.shipmentId, shipments.id))
    .where(and(
      eq(shipments.userId,       targetUserId),
      eq(commissions.status,     "pending"),
      isNull(commissions.stripeInvoiceId),
    ));

  if (pendingRows.length === 0) {
    throw new Error("NO_PENDING_COMMISSIONS");
  }

  // 2. Load user + upsert Stripe customer
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!user) throw new Error("User not found");

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name:  user.name ?? undefined,
      metadata: { wassalhaUserId: user.id },
    });
    customerId = customer.id;
    await db.update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, targetUserId));
  }

  // 3. Create invoice + line items
  const invoice = await stripe.invoices.create({
    customer:         customerId,
    auto_advance:     false,
    collection_method: "send_invoice",
    days_until_due:   30,
    metadata:         { wassalhaUserId: targetUserId },
  });

  for (const row of pendingRows) {
    const ref = row.trackingNumber ?? row.shipmentId;
    if (row.shippingFee > 0) {
      await stripe.invoiceItems.create({
        customer:   customerId,
        invoice:    invoice.id,
        amount:     row.shippingFee, // centimes = Stripe smallest unit (MAD)
        currency:   "mad",
        description: `Commission expédition – ${ref}`,
      });
    }
    if (row.codFee > 0) {
      await stripe.invoiceItems.create({
        customer:   customerId,
        invoice:    invoice.id,
        amount:     row.codFee,
        currency:   "mad",
        description: `Commission COD – ${ref}`,
      });
    }
  }

  // 4. Finalize + send
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
  await stripe.invoices.sendInvoice(finalized.id);

  // 5. Mark commissions invoiced
  const ids = pendingRows.map((r) => r.commissionId);
  await db.update(commissions)
    .set({ status: "invoiced", stripeInvoiceId: finalized.id })
    .where(inArray(commissions.id, ids));

  return {
    invoiceId:  finalized.id,
    invoiceUrl: finalized.hosted_invoice_url ?? "",
  };
}

export interface InvoiceListRow {
  invoiceId:  string;
  retailer:   string;
  date:       string;
  amountMad:  number;
  status:     string;
  pdfUrl:     string | null;
}

/** List recent Stripe invoices for the billing dashboard. */
export async function listInvoices(limit = 50): Promise<InvoiceListRow[]> {
  const stripe   = getStripe();
  const response = await stripe.invoices.list({ limit });

  return response.data.map((inv) => ({
    invoiceId: inv.id,
    retailer:  typeof inv.customer_email === "string" ? inv.customer_email : "—",
    date:      new Date(inv.created * 1000).toISOString(),
    amountMad: (inv.amount_due ?? 0) / 100,
    status:    inv.status ?? "unknown",
    pdfUrl:    inv.invoice_pdf ?? null,
  }));
}
```

---

### Task 17: POST + GET /api/billing/invoices

**Files:**
- Create: `src/app/api/billing/invoices/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRetailerInvoice, listInvoices } from "@/lib/services/billing";

const CreateInvoiceSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createRetailerInvoice(parsed.data.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_PENDING_COMMISSIONS") {
      return NextResponse.json({ error: "No pending commissions" }, { status: 400 });
    }
    console.error("[POST /api/billing/invoices]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invoices = await listInvoices();
  return NextResponse.json(invoices);
}
```

---

### Task 18: POST /api/webhooks/stripe (invoice.paid)

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

```ts
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { commissions } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });

  const body      = await req.text();
  const headerMap = await headers();
  const sig       = headerMap.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    await db
      .update(commissions)
      .set({ status: "paid" })
      .where(eq(commissions.stripeInvoiceId, invoice.id));
  }

  return new Response("OK", { status: 200 });
}
```

---

### Task 19: useBilling TanStack Query hook

**Files:**
- Create: `src/hooks/use-billing.ts`

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceListRow } from "@/lib/services/billing";

export function useInvoices() {
  return useQuery<InvoiceListRow[]>({
    queryKey: ["billing", "invoices"],
    queryFn:  async () => {
      const res = await fetch("/api/billing/invoices");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json() as Promise<InvoiceListRow[]>;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/billing/invoices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? "Failed to create invoice");
      }
      return res.json() as Promise<{ invoiceId: string; invoiceUrl: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["billing", "invoices"] });
      void qc.invalidateQueries({ queryKey: ["analytics", "summary"] });
    },
  });
}
```

---

### Task 20: RetailerBillingTable + InvoiceHistoryTable components

**Files:**
- Create: `src/components/billing/retailer-billing-table.tsx`
- Create: `src/components/billing/invoice-history-table.tsx`

**Step 1: RetailerBillingTable**

```tsx
// src/components/billing/retailer-billing-table.tsx
"use client";

import { useCreateInvoice } from "@/hooks/use-billing";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RetailerBillingRow } from "@/lib/services/billing";

export function RetailerBillingTable({ rows }: { rows: RetailerBillingRow[] }) {
  const { mutate, isPending } = useCreateInvoice();

  function handleGenerate(userId: string) {
    mutate(userId, {
      onSuccess: (data) => {
        toast.success("Facture envoyée", {
          description: "La facture a été envoyée au client par email.",
          action: { label: "Voir", onClick: () => window.open(data.invoiceUrl, "_blank") },
        });
      },
      onError: (err) => toast.error(err.message),
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune commission en attente.</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Revendeur</th>
            <th className="px-4 py-3 text-right font-medium">Commission en attente</th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.userId}>
              <td className="px-4 py-3">
                <div className="font-medium">{row.email}</div>
                {row.name && <div className="text-xs text-muted-foreground">{row.name}</div>}
              </td>
              <td className="px-4 py-3 text-right">
                {row.pendingTotalMad.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  disabled={isPending || row.pendingTotalMad === 0}
                  onClick={() => handleGenerate(row.userId)}
                  title={row.pendingTotalMad === 0 ? "Aucune commission en attente" : undefined}
                >
                  Générer facture
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: InvoiceHistoryTable**

```tsx
// src/components/billing/invoice-history-table.tsx
"use client";

import { useInvoices } from "@/hooks/use-billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  draft:         "Brouillon",
  open:          "Ouverte",
  paid:          "Payée",
  uncollectible: "Irrécouvrable",
  void:          "Annulée",
};

export function InvoiceHistoryTable() {
  const { data, isPending, isError } = useInvoices();

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError)   return <p className="text-sm text-destructive">Erreur de chargement</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Aucune facture.</p>;

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Revendeur</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Montant</th>
            <th className="px-4 py-3 text-left font-medium">Statut</th>
            <th className="px-4 py-3 text-right font-medium">PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((inv) => (
            <tr key={inv.invoiceId}>
              <td className="px-4 py-3">{inv.retailer}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(inv.date).toLocaleDateString("fr-MA")}
              </td>
              <td className="px-4 py-3 text-right">
                {inv.amountMad.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })}
              </td>
              <td className="px-4 py-3">
                <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                {inv.pdfUrl ? (
                  <Button variant="link" size="sm" asChild>
                    <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">Voir PDF</a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### Task 21: /admin/billing/page.tsx RSC

**Files:**
- Create: `src/app/(dashboard)/admin/billing/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRetailersBillingOverview } from "@/lib/services/billing";
import { getAnalyticsSummary } from "@/lib/services/analytics";
import { RetailerBillingTable } from "@/components/billing/retailer-billing-table";
import { InvoiceHistoryTable } from "@/components/billing/invoice-history-table";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function BillingPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") redirect("/dashboard");

  const [summary, retailers] = await Promise.all([
    getAnalyticsSummary(userId, "admin"),
    getRetailersBillingOverview(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Facturation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline de commissions et génération de factures Stripe
        </p>
      </div>

      {summary.pipeline && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="En attente"  value={`${summary.pipeline.pendingMad.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })}`}  description="À facturer" />
          <StatCard title="Facturé"     value={`${summary.pipeline.invoicedMad.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })}`} description="En attente paiement" />
          <StatCard title="Encaissé"    value={`${summary.pipeline.paidMad.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })}`}    description="Reçu" />
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Revendeurs avec commissions en attente</h2>
        <RetailerBillingTable rows={retailers} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Historique des factures</h2>
        <InvoiceHistoryTable />
      </div>
    </div>
  );
}
```

---

## Part 7 — Navigation + Middleware + Verification

### Task 22: Update navigation + middleware

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/middleware.ts`

**Step 1: Add nav links**

In `src/app/(dashboard)/layout.tsx`, add to the nav:

```tsx
<Link href="/analytics" className="text-muted-foreground hover:text-foreground">
  Analytiques
</Link>
{isAdmin && (
  <Link href="/admin/billing" className="text-muted-foreground hover:text-foreground">
    Facturation
  </Link>
)}
```

**Step 2: Confirm middleware covers new admin route**

Open `src/middleware.ts` and confirm the Clerk middleware matcher includes `/(dashboard)/admin/(.*)`. If not, add `/admin/billing` to the protected patterns. No change expected — existing matcher should already cover it.

---

### Task 23: Final verification

**Step 1: Type-check + lint + build**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

**Step 2: Smoke-test checklist**

- [ ] `/dashboard` loads with 6 KPI cards (retailer) or 9 cards (admin)
- [ ] `/analytics` renders tabs, DateRangePicker changes chart data
- [ ] "Exporter CSV" downloads `wassalha-shipments-YYYY-MM-DD.csv`
- [ ] `/admin/billing` visible only for admin role
- [ ] "Générer facture" button disabled when 0 pending commissions
- [ ] `POST /api/billing/invoices` returns 400 for non-admin
- [ ] `GET /api/commissions/export` returns 403 for retailer
- [ ] Existing 107 tests still pass: `pnpm test`

```bash
pnpm test
```

Expected: 107+ tests passing, 0 regressions.
