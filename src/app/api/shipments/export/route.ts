import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, commissions, carriers } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type ShipmentStatus = InferSelectModel<typeof shipments>["status"];

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines   = rows.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

const EMPTY_HEADERS =
  "id,date,recipient,city,carrier,status,shipping_cost_mad,cod_amount_mad,commission_total_mad,mode";

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const { searchParams } = new URL(req.url);
  const fromParam    = searchParams.get("from");
  const toParam      = searchParams.get("to");
  const statusParam  = searchParams.get("status") as ShipmentStatus | null;
  const carrierParam = searchParams.get("carrierId");

  const filters = [
    role === "retailer" ? eq(shipments.userId, userId) : undefined,
    fromParam    ? gte(shipments.createdAt, new Date(fromParam))  : undefined,
    toParam      ? lte(shipments.createdAt, new Date(toParam))    : undefined,
    statusParam  ? eq(shipments.status, statusParam)              : undefined,
    carrierParam ? eq(shipments.carrierId, carrierParam)          : undefined,
  ].filter((f) => f !== undefined);

  const rows = await db
    .select({
      id:                   shipments.id,
      date:                 shipments.createdAt,
      recipient:            shipments.recipientName,
      city:                 shipments.recipientCity,
      carrier:              carriers.name,
      status:               shipments.status,
      shipping_cost_mad:    shipments.shippingCostMad,
      cod_amount_mad:       shipments.codAmountMad,
      commission_total_mad: commissions.totalCommissionMad,
      mode:                 shipments.mode,
    })
    .from(shipments)
    .leftJoin(carriers,    eq(shipments.carrierId,    carriers.id))
    .leftJoin(commissions, eq(commissions.shipmentId, shipments.id))
    .where(and(...filters));

  const date     = new Date().toISOString().slice(0, 10);
  const filename = `wassalha-shipments-${date}.csv`;
  const csv      = rows.length > 0 ? toCsv(rows as Record<string, unknown>[]) : EMPTY_HEADERS;

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
