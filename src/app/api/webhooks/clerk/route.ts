import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type ClerkUserEventData = {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
};

type ClerkWebhookEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: ClerkUserEventData;
};

function getPrimaryEmail(data: ClerkUserEventData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? "";
}

function getFullName(data: ClerkUserEventData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created") {
    await db.insert(users).values({
      id: data.id,
      email: getPrimaryEmail(data),
      name: getFullName(data),
      role: "retailer",
    });
  }

  if (type === "user.updated") {
    await db
      .update(users)
      .set({
        email: getPrimaryEmail(data),
        name: getFullName(data),
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.id));
  }

  if (type === "user.deleted") {
    await db.delete(users).where(eq(users.id, data.id));
  }

  return new Response("OK", { status: 200 });
}
