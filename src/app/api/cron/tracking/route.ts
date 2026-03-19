import { after } from "next/server";
import { pollActiveShipments } from "@/lib/services/tracking";
import { sendWebPushToUser } from "@/lib/notifications/web-push";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processed, errors, pushTasks } = await pollActiveShipments();

  // Schedule push notifications after the response is sent.
  // after() keeps the Vercel function alive so the FCM requests complete.
  if (pushTasks.length > 0) {
    after(async () => {
      await Promise.allSettled(
        pushTasks.map((t) =>
          sendWebPushToUser(t.userId, t.shipmentId, {
            title: "Colis mis à jour",
            body:  `Votre envoi est maintenant : ${t.status.replace("_", " ")}`,
          }),
        ),
      );
    });
  }

  return Response.json({ ok: true, processed, errors });
}
