import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getZone, deleteZone } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string; zoneId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
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

  try {
    const deleted = await deleteZone(zoneId);
    return NextResponse.json(deleted);
  } catch {
    // FK restrict violation — pricing rows exist
    return NextResponse.json(
      { error: "Delete all pricing rows for this zone first", code: "ZONE_HAS_PRICING" },
      { status: 409 }
    );
  }
}
