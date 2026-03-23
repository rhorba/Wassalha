import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getShipmentById } from "@/lib/services/bookings";
import { getAdapter } from "@/lib/carriers/adapters";
import { CarrierApiError } from "@/lib/carriers/types";
import type { AramexAdapter } from "@/lib/carriers/adapters/aramex";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role =
    (sessionClaims?.publicMetadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const shipment = await getShipmentById(id, userId, role);
  if (!shipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (shipment.carrier.slug !== "aramex") {
    return NextResponse.json({ error: "label_not_supported" }, { status: 400 });
  }

  if (!shipment.carrierTrackingNumber) {
    return NextResponse.json({ error: "no_tracking_number" }, { status: 400 });
  }

  try {
    const adapter = getAdapter("aramex") as AramexAdapter;
    const labelUrl = await adapter.printLabel(shipment.carrierTrackingNumber);
    return NextResponse.redirect(labelUrl, 302);
  } catch (err) {
    if (err instanceof CarrierApiError) {
      return NextResponse.json({ error: "label_unavailable" }, { status: 502 });
    }
    throw err;
  }
}
