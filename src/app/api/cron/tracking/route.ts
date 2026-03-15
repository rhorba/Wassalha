import { pollActiveShipments } from "@/lib/services/tracking";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollActiveShipments();
  return Response.json({ ok: true, ...result });
}
