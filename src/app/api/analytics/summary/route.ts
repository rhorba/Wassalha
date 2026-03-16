import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/services/analytics";

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const summary = await getAnalyticsSummary(userId, role);
  return NextResponse.json(summary);
}
