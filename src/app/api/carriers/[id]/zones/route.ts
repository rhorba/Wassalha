import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CreateZoneSchema } from "@/lib/validations/carriers";
import { getCarrierById, createZone } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const carrier = await getCarrierById(id);
  if (!carrier) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = CreateZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const zone = await createZone(id, parsed.data);
  return NextResponse.json(zone, { status: 201 });
}
