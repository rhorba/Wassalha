import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAnalyticsCharts } from "@/lib/services/analytics";

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const { searchParams } = new URL(req.url);
  const now  = new Date();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to   = searchParams.get("to") ? new Date(searchParams.get("to")!) : now;

  const charts = await getAnalyticsCharts(userId, role, from, to);
  return NextResponse.json(charts);
}
