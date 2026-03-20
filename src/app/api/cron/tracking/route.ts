import { pollActiveShipments } from "@/lib/services/tracking";
import { sendWebPushToUser } from "@/lib/notifications/web-push";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processed, errors, pushTasks } = await pollActiveShipments();

  // Await push sends directly so errors surface in the response (debug mode).
  const pushResults = await Promise.allSettled(
    pushTasks.map((t) =>
      sendWebPushToUser(t.userId, t.shipmentId, {
        title: "Colis mis à jour",
        body:  `Votre envoi est maintenant : ${t.status.replace("_", " ")}`,
      }),
    ),
  );

  const pushErrors = pushResults
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? String((r as PromiseRejectedResult).reason));

  return Response.json({ ok: true, processed, errors, pushTasks: pushTasks.length, pushErrors });
}
