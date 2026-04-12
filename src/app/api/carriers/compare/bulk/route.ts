import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { BulkCompareRequestSchema } from "@/lib/validations/carriers";
import { compareCarriers } from "@/lib/services/comparison";
import { ratelimit, checkRateLimit } from "@/lib/rate-limit";
import type { BulkCompareResultRow } from "@/lib/validations/carriers";

export async function POST(req: Request) {
  const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
  const { limited, retryAfter } = await checkRateLimit(ratelimit.compareBulk, ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = BulkCompareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { globalMode, rows } = parsed.data;
  const results: BulkCompareResultRow[] = [];

  // Process rows sequentially to avoid DB connection surge
  for (const row of rows) {
    const mode = row.mode ?? globalMode;
    try {
      const outcome = await compareCarriers({ ...row, mode });

      if ("error" in outcome) {
        results.push({
          rowIndex:     row.rowIndex,
          label:        row.label,
          input:        { ...row, mode },
          bestCarrier:  null,
          allResults:   [],
          cityNotFound: outcome.error.code === "CITY_NOT_FOUND",
          error:
            outcome.error.code === "CITY_NOT_FOUND"
              ? "Destination city not found"
              : "No results",
        });
      } else {
        results.push({
          rowIndex:     row.rowIndex,
          label:        row.label,
          input:        { ...row, mode },
          bestCarrier:  outcome.results[0] ?? null,
          allResults:   outcome.results,
          cityNotFound: false,
          error:
            outcome.results.length === 0
              ? "No carriers available for this route"
              : null,
        });
      }
    } catch {
      results.push({
        rowIndex:     row.rowIndex,
        label:        row.label,
        input:        { ...row, mode },
        bestCarrier:  null,
        allResults:   [],
        cityNotFound: false,
        error:        "Comparison failed — please retry",
      });
    }
  }

  return NextResponse.json({ results });
}
