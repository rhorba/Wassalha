import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, notifications } from "@/lib/db/schema";

interface PushPayload {
  title: string;
  body:  string;
}

/**
 * Send a Web Push notification to all subscriptions for a given user.
 * Fire-and-forget safe — never throws.
 * Auto-removes stale subscriptions (410 Gone).
 * Inserts a notifications row per send attempt.
 */
export async function sendWebPushToUser(
  userId:     string,
  shipmentId: string,
  payload:    PushPayload,
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("[web-push] VAPID keys not set — skipping push notification");
    return;
  }

  // Lazily initialize VAPID — avoids module-level throw when keys are absent.
  // Normalize to base64url: replace standard base64 chars, strip padding.
  const toBase64url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@wassalha.ma",
    toBase64url(process.env.VAPID_PUBLIC_KEY),
    toBase64url(process.env.VAPID_PRIVATE_KEY),
  );

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      let sent = false;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent = true;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410) {
          // Subscription expired — remove it
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
          console.info("[web-push] Removed stale subscription:", sub.endpoint);
        } else {
          console.error("[web-push] Send failed:", err);
        }
      }

      // Log notification attempt (fire-and-forget)
      try {
        await db.insert(notifications).values({
          shipmentId,
          channel: "web_push",
          status:  sent ? "sent" : "failed",
        });
      } catch (logErr) {
        console.error("[web-push] Failed to log notification:", logErr);
      }
    }),
  );
}
