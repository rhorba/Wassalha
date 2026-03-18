import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UpdateCarrierSchema } from "@/lib/validations/carriers";
import {
  getCarrierById,
  updateCarrier,
  softDeleteCarrier,
  getCarrierBySlug,
} from "@/lib/services/carriers";
import { logAuditEvent } from "@/lib/services/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const carrier = await getCarrierById(id);
  if (!carrier) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }
  return NextResponse.json(carrier);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = UpdateCarrierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await getCarrierById(id);
  if (!existing) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }

  // Slug uniqueness check (if slug is being changed)
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugOwner = await getCarrierBySlug(parsed.data.slug);
    if (slugOwner) {
      return NextResponse.json(
        { error: "Slug already exists", code: "SLUG_CONFLICT" },
        { status: 409 }
      );
    }
  }

  const updated = await updateCarrier(id, parsed.data);

  await logAuditEvent({
    actorId:    userId ?? "unknown",
    actorRole:  "admin",
    action:     "carrier.update",
    targetType: "carrier",
    targetId:   id,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getCarrierById(id);
  if (!existing) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }

  const carrier = await softDeleteCarrier(id);

  await logAuditEvent({
    actorId:    userId ?? "unknown",
    actorRole:  "admin",
    action:     "carrier.delete",
    targetType: "carrier",
    targetId:   id,
  });

  return NextResponse.json(carrier);
}
