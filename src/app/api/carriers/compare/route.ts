import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CompareInputSchema } from "@/lib/validations/carriers";
import { compareCarriers } from "@/lib/services/comparison";
import { ratelimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
  const { limited, retryAfter } = await checkRateLimit(ratelimit.compare, ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Any authenticated user may compare — no admin check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = CompareInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const outcome = await compareCarriers(parsed.data);

  // CITY_NOT_FOUND → return empty results with a hint, not a 422.
  // The autocomplete should prevent unknown cities, but if one slips through
  // (e.g. a Google Places variant not yet in city-zones.json) we show empty
  // results rather than a blocking error.
  if ("error" in outcome) {
    return NextResponse.json({ results: [], cityNotFound: true });
  }

  return NextResponse.json(outcome);
}
