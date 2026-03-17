import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRetailerInvoice, listInvoices } from "@/lib/services/billing";
import { ratelimit, checkRateLimit } from "@/lib/rate-limit";

const CreateInvoiceSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { limited, retryAfter } = await checkRateLimit(ratelimit.billing, userId);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body   = await req.json() as unknown;
  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createRetailerInvoice(parsed.data.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_PENDING_COMMISSIONS") {
      return NextResponse.json({ error: "No pending commissions" }, { status: 400 });
    }
    console.error("[POST /api/billing/invoices]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const invoices = await listInvoices();
    return NextResponse.json(invoices);
  } catch (err) {
    // Stripe not configured or key invalid — return empty list gracefully
    if (
      (err instanceof Error && err.message === "STRIPE_SECRET_KEY is not set") ||
      (err as { type?: string })?.type === "StripeAuthenticationError"
    ) {
      return NextResponse.json([]);
    }
    console.error("[GET /api/billing/invoices]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
