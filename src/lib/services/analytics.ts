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
  const shipWhere = role === "admin" ? undefined : eq(shipments.userId, userId);

  const [shipRow] = await db
    .select({
      total:      sql<number>`count(*)::int`,
      active:     sql<number>`count(*) filter (where status in ('confirmed','picked_up','in_transit'))::int`,
      delivered:  sql<number>`count(*) filter (where status = 'delivered')::int`,
      totalSpend: sql<number>`coalesce(sum(shipping_cost_mad), 0)::int`,
      totalCod:   sql<number>`coalesce(sum(cod_amount_mad) filter (where status = 'delivered'), 0)::int`,
    })
    .from(shipments)
    .where(shipWhere);

  const commWhere = role === "admin"
    ? undefined
    : eq(shipments.userId, userId);

  const [commRow] = await db
    .select({
      paid:     sql<number>`coalesce(sum(${commissions.totalCommissionMad}) filter (where ${commissions.status} = 'paid'), 0)::int`,
      pending:  sql<number>`coalesce(sum(${commissions.totalCommissionMad}) filter (where ${commissions.status} = 'pending'), 0)::int`,
      invoiced: sql<number>`coalesce(sum(${commissions.totalCommissionMad}) filter (where ${commissions.status} = 'invoiced'), 0)::int`,
    })
    .from(commissions)
    .leftJoin(shipments, eq(commissions.shipmentId, shipments.id))
    .where(commWhere);

  const total     = shipRow?.total ?? 0;
  const delivered = shipRow?.delivered ?? 0;

  return {
    totalShipments:    total,
    activeShipments:   shipRow?.active ?? 0,
    deliveredCount:    delivered,
    successRate:       total > 0 ? Math.round((delivered / total) * 100) : 0,
    totalSpendMad:     toMad(shipRow?.totalSpend ?? null),
    totalCodMad:       toMad(shipRow?.totalCod ?? null),
    commissionPaidMad: toMad(commRow?.paid ?? null),
    pipeline: role === "admin"
      ? {
          pendingMad:  toMad(commRow?.pending ?? null),
          invoicedMad: toMad(commRow?.invoiced ?? null),
          paidMad:     toMad(commRow?.paid ?? null),
        }
      : null,
  };
}

export interface ChartWeekPoint {
  week:          string; // ISO date string
  shipments:     number;
  spendMad:      number;
  commissionMad: number;
}

export interface CarrierBreakdownPoint {
  carrier:  string;
  count:    number;
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
  const userFilter = role === "admin"
    ? sql`1=1`
    : sql`s.user_id = ${userId}`;

  // Weekly time-series — raw SQL for GROUP BY date_trunc (complex aggregation)
  const timeRows = await db.execute<{
    week:       string;
    shipments:  number;
    spend:      number;
    commission: number;
  }>(sql`
    select
      date_trunc('week', s.created_at)::text                    as week,
      count(*)::int                                              as shipments,
      coalesce(sum(s.shipping_cost_mad), 0)::int                as spend,
      coalesce(sum(c.total_commission_mad), 0)::int             as commission
    from shipments s
    left join commissions c on c.shipment_id = s.id
    where ${userFilter}
      and s.created_at >= ${from}
      and s.created_at <= ${to}
    group by 1
    order by 1
  `);

  const carrierWhere = role === "admin"
    ? and(gte(shipments.createdAt, from), lte(shipments.createdAt, to))
    : and(
        eq(shipments.userId, userId),
        gte(shipments.createdAt, from),
        lte(shipments.createdAt, to),
      );

  const carrierRows = await db
    .select({
      carrier: carriers.name,
      count:   sql<number>`count(*)::int`,
      spend:   sql<number>`coalesce(sum(${shipments.shippingCostMad}), 0)::int`,
    })
    .from(shipments)
    .leftJoin(carriers, eq(shipments.carrierId, carriers.id))
    .where(carrierWhere)
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
