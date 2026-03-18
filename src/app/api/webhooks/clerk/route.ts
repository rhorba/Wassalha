import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPrimaryEmail, getFullName } from "@/lib/utils/clerk-webhook";
import { logAuditEvent } from "@/lib/services/audit";

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

    await logAuditEvent({
      actorId:    "clerk_webhook",
      actorRole:  "system",
      action:     "role.change",
      targetType: "user",
      targetId:   data.id,
    });
  }

  if (type === "user.deleted") {
    await db.delete(users).where(eq(users.id, data.id));
  }

  return new Response("OK", { status: 200 });
}
