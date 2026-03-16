import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRetailerInvoice, listInvoices } from "@/lib/services/billing";

const CreateInvoiceSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    // Stripe key not configured — return empty list gracefully
    if (err instanceof Error && err.message === "STRIPE_SECRET_KEY is not set") {
      return NextResponse.json([]);
    }
    console.error("[GET /api/billing/invoices]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
