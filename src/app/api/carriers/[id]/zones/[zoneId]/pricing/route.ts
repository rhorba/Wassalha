import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CreatePricingSchema } from "@/lib/validations/carriers";
import { getZone, createPricing } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string; zoneId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { zoneId } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const zone = await getZone(zoneId);
  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = CreatePricingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pricing = await createPricing(zoneId, parsed.data);
  return NextResponse.json(pricing, { status: 201 });
}
