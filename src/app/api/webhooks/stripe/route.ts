import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { commissions } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });

  const body      = await req.text();
  const headerMap = await headers();
  const sig       = headerMap.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    await db
      .update(commissions)
      .set({ status: "paid" })
      .where(eq(commissions.stripeInvoiceId, invoice.id));
  }

  return new Response("OK", { status: 200 });
}
