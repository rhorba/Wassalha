import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CreateCarrierSchema } from "@/lib/validations/carriers";
import {
  listCarriers,
  createCarrier,
  getCarrierBySlug,
} from "@/lib/services/carriers";

export async function GET() {
  try {
    const data = await listCarriers();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch carriers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = CreateCarrierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await getCarrierBySlug(parsed.data.slug);
  if (existing) {
    return NextResponse.json(
      { error: "Slug already exists", code: "SLUG_CONFLICT" },
      { status: 409 }
    );
  }

  const carrier = await createCarrier(parsed.data);
  return NextResponse.json(carrier, { status: 201 });
}
