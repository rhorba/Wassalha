import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers, shipments, commissions } from "@/lib/db/schema";
import { getAdapter } from "@/lib/carriers/adapters";
import { CarrierApiError } from "@/lib/carriers/types";
import { calculateCommission } from "./commission";
import { sendBookingConfirmationEmail } from "@/lib/notifications/email";
import { sendRecipientWhatsApp } from "@/lib/notifications/whatsapp";
import { clerkClient } from "@clerk/nextjs/server";
import type { BookingInput } from "@/lib/validations/shipments";
import type { Shipment } from "@/lib/db/schema";

export { CarrierApiError };

export async function createBooking(
  userId: string,
  input: BookingInput,
): Promise<{ shipment: Shipment; trackingNumber: string }> {
  // 1. Load carrier to resolve adapter slug
  const carrier = await db.query.carriers.findFirst({
    where: eq(carriers.id, input.carrierId),
  });
  if (!carrier) throw new Error("Carrier not found");

  // 2. Call carrier adapter — normalize all errors to CarrierApiError
  //    so the API route always returns 502 (never 500) on carrier failures.
  //    TypeError from fetch (e.g. empty API URL) is caught here too.
  const adapter = getAdapter(carrier.slug);
  let result: Awaited<ReturnType<typeof adapter.createShipment>>;
  try {
    result = await adapter.createShipment({
      recipientName:     input.recipientName,
      recipientPhone:    input.recipientPhone,
      recipientCity:     input.recipientCity,
      recipientAddress:  input.recipientAddress,
      originCity:        input.originCity,
      weightG:           input.weightG,
      codAmountMad:      input.codAmountMad,
      parcelDescription: input.parcelDescription,
    });
  } catch (err) {
    if (err instanceof CarrierApiError) throw err;
    // Unexpected error (e.g. missing API URL env var, network failure)
    console.error(`[adapter:${carrier.slug}]`, err);
    throw new CarrierApiError(
      "SERVICE_UNAVAILABLE",
      `${carrier.name}: service unavailable`,
    );
  }

  // 3. Calculate commission
  const commission = calculateCommission(input.shippingCostMad, input.codAmountMad);

  // 4. Write shipment + commission atomically
  const shipment = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(shipments)
      .values({
        userId,
        carrierId:             input.carrierId,
        status:                "confirmed",
        recipientName:         input.recipientName,
        recipientPhone:        input.recipientPhone,
        recipientCity:         input.recipientCity,
        recipientAddress:      input.recipientAddress,
        originCity:            input.originCity,
        weightG:               input.weightG,
        codAmountMad:          input.codAmountMad,
        shippingCostMad:       input.shippingCostMad,
        parcelDescription:     input.parcelDescription,
        mode:                  input.mode,
        carrierTrackingNumber: result.trackingNumber,
        carrierReference:      result.carrierReference,
      })
      .returning();

    await tx.insert(commissions).values({
      shipmentId:           s.id,
      shippingFeePercent:   commission.shippingFeePercent.toString(),
      shippingFeeAmountMad: commission.shippingFeeAmountMad,
      codFeePercent:        commission.codFeePercent.toString(),
      codFeeAmountMad:      commission.codFeeAmountMad,
      totalCommissionMad:   commission.totalCommissionMad,
      status:               "pending",
    });

    return s;
  });

  // 5. Fire-and-forget notifications — failures are logged, not thrown
  const clerk     = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId).catch(() => null);

  void sendBookingConfirmationEmail({
    retailerEmail: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
    retailerName:  clerkUser?.fullName ?? "Retailer",
    shipment,
    carrier,
    commission,
  });

  void sendRecipientWhatsApp({
    recipientPhone:     input.recipientPhone,
    recipientName:      input.recipientName,
    carrierName:        carrier.name,
    trackingNumber:     result.trackingNumber,
    senderBusinessName: clerkUser?.fullName ?? "Wassalha",
  });

  return { shipment, trackingNumber: result.trackingNumber };
}

export async function listShipments(
  userId: string,
  role: "retailer" | "admin",
  page: number,
  pageSize: number,
) {
  const offset    = (page - 1) * pageSize;
  const whereClause = role === "admin" ? undefined : eq(shipments.userId, userId);

  const rows = await db.query.shipments.findMany({
    where:   whereClause,
    with:    { carrier: true, commission: true },
    limit:   pageSize,
    offset,
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shipments)
    .where(whereClause);

  return { shipments: rows, total: count, page, pageSize };
}

export async function getShipmentById(
  id: string,
  userId: string,
  role: "retailer" | "admin",
) {
  const shipment = await db.query.shipments.findFirst({
    where: eq(shipments.id, id),
    with:  { carrier: true, commission: true },
  });

  if (!shipment) return null;
  // Retailers can only see their own shipments
  if (role === "retailer" && shipment.userId !== userId) return null;

  return shipment;
}
