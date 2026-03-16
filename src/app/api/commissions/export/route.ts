import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, commissions, users } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type CommissionStatus = InferSelectModel<typeof commissions>["status"];

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines   = rows.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

const EMPTY_HEADERS =
  "id,date,retailer_email,shipment_id,shipping_fee_mad,cod_fee_mad,total_mad,status,stripe_invoice_id";

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const fromParam   = searchParams.get("from");
  const toParam     = searchParams.get("to");
  const statusParam = searchParams.get("status") as CommissionStatus | null;

  const filters = [
    fromParam   ? gte(commissions.createdAt, new Date(fromParam))  : undefined,
    toParam     ? lte(commissions.createdAt, new Date(toParam))    : undefined,
    statusParam ? eq(commissions.status, statusParam)              : undefined,
  ].filter((f) => f !== undefined);

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
    .leftJoin(users,     eq(shipments.userId,       users.id))
    .where(and(...filters));

  const date     = new Date().toISOString().slice(0, 10);
  const filename = `wassalha-commissions-${date}.csv`;
  const csv      = rows.length > 0 ? toCsv(rows as Record<string, unknown>[]) : EMPTY_HEADERS;

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
