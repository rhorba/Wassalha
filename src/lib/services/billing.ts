import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { commissions, shipments, users } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";

export interface RetailerBillingRow {
  userId:          string;
  email:           string;
  name:            string | null;
  pendingCount:    number;
  pendingTotalMad: number;
}

/** All retailers who have at least one un-invoiced pending commission. */
export async function getRetailersBillingOverview(): Promise<RetailerBillingRow[]> {
  const rows = await db
    .select({
      userId:       users.id,
      email:        users.email,
      name:         users.name,
      pendingCount: sql<number>`count(${commissions.id})::int`,
      pendingTotal: sql<number>`coalesce(sum(${commissions.totalCommissionMad}), 0)::int`,
    })
    .from(users)
    .innerJoin(shipments,   eq(shipments.userId,       users.id))
    .innerJoin(commissions, and(
      eq(commissions.shipmentId, shipments.id),
      eq(commissions.status,     "pending"),
      isNull(commissions.stripeInvoiceId),
    ))
    .groupBy(users.id, users.email, users.name);

  return rows.map((r) => ({
    userId:          r.userId,
    email:           r.email,
    name:            r.name,
    pendingCount:    r.pendingCount,
    pendingTotalMad: Math.round((r.pendingTotal / 100) * 100) / 100,
  }));
}

export interface InvoiceResult {
  invoiceId:  string;
  invoiceUrl: string;
}

/** Create a Stripe invoice for all pending un-invoiced commissions of a retailer. */
export async function createRetailerInvoice(
  targetUserId: string,
): Promise<InvoiceResult> {
  const stripe = getStripe();

  // 1. Load pending commissions
  const pendingRows = await db
    .select({
      commissionId:   commissions.id,
      trackingNumber: shipments.carrierTrackingNumber,
      shipmentId:     commissions.shipmentId,
      shippingFee:    commissions.shippingFeeAmountMad,
      codFee:         commissions.codFeeAmountMad,
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
      email:    user.email,
      name:     user.name ?? undefined,
      metadata: { wassalhaUserId: user.id },
    });
    customerId = customer.id;
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, targetUserId));
  }

  // 3. Create draft invoice
  const invoice = await stripe.invoices.create({
    customer:           customerId,
    auto_advance:       false,
    collection_method:  "send_invoice",
    days_until_due:     30,
    metadata:           { wassalhaUserId: targetUserId },
  });

  // 4. Add line items
  for (const row of pendingRows) {
    const ref = row.trackingNumber ?? row.shipmentId;
    if (row.shippingFee > 0) {
      await stripe.invoiceItems.create({
        customer:    customerId,
        invoice:     invoice.id,
        amount:      row.shippingFee,
        currency:    "mad",
        description: `Commission expédition – ${ref}`,
      });
    }
    if (row.codFee > 0) {
      await stripe.invoiceItems.create({
        customer:    customerId,
        invoice:     invoice.id,
        amount:      row.codFee,
        currency:    "mad",
        description: `Commission COD – ${ref}`,
      });
    }
  }

  // 5. Finalize + send (Stripe emails PDF to retailer)
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {
    auto_advance: true,
  });
  await stripe.invoices.sendInvoice(finalized.id);

  // 6. Mark commissions as invoiced
  const ids = pendingRows.map((r) => r.commissionId);
  await db
    .update(commissions)
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
