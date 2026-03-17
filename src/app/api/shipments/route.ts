import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { BookingInputSchema } from "@/lib/validations/shipments";
import { createBooking, listShipments, CarrierApiError } from "@/lib/services/bookings";
import { ratelimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { limited, retryAfter } = await checkRateLimit(ratelimit.booking, userId);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body: unknown = await req.json();
  const parsed = BookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { shipment, trackingNumber } = await createBooking(userId, parsed.data);
    return NextResponse.json({ shipment, trackingNumber }, { status: 201 });
  } catch (err) {
    if (err instanceof CarrierApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 502 },
      );
    }
    if (err instanceof Error && err.message === "Carrier not found") {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }
    console.error("[POST /api/shipments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "20", 10));

  const result = await listShipments(userId, role, page, pageSize);
  return NextResponse.json(result);
}
