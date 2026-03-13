import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deletePricing } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string; zoneId: string; pricingId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { pricingId } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await deletePricing(pricingId);
  if (!deleted) {
    return NextResponse.json({ error: "Pricing row not found" }, { status: 404 });
  }
  return NextResponse.json(deleted);
}
