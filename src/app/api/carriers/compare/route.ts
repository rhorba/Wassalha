import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CompareInputSchema } from "@/lib/validations/carriers";
import { compareCarriers } from "@/lib/services/comparison";

export async function POST(req: Request) {
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
