import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getShipmentById } from "@/lib/services/bookings";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const shipment = await getShipmentById(id, userId, role);
  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ shipment });
}
