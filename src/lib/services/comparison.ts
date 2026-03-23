import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { cityToCarrierZoneCode, isCityKnown } from "@/lib/carriers/city-zones";
import { getAdapter } from "@/lib/carriers/adapters";
import type { AramexAdapter } from "@/lib/carriers/adapters/aramex";
import type { CompareInput, CarrierResult, UnavailableCarrier } from "@/lib/validations/carriers";

const MODE_WEIGHTS = {
  cheapest: { cost: 0.7, speed: 0.2, reliability: 0.1 },
  balanced: { cost: 0.4, speed: 0.3, reliability: 0.3 },
  fastest:  { cost: 0.2, speed: 0.5, reliability: 0.3 },
} as const;

export type CompareError =
  | { code: "CITY_NOT_FOUND"; field: "originCity" | "destinationCity" }
  | { code: "NO_RESULTS" };

function raceTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms),
  );
}

export async function compareCarriers(
  input: CompareInput,
): Promise<{ results: CarrierResult[]; unavailable: UnavailableCarrier[] } | { error: CompareError }> {
  if (!isCityKnown(input.destinationCity)) {
    return { error: { code: "CITY_NOT_FOUND", field: "destinationCity" } };
  }

  const activeCarriers = await db.query.carriers.findMany({
    where: eq(carriers.isActive, true),
    with: { zones: { with: { pricing: true } } },
  });

  type RawResult = {
    carrierId:        string;
    slug:             string;
    name:             string;
    logoUrl:          string | null;
    reliabilityScore: number;
    priceMad:         number;
    codFeeMad:        number;
    codFeePercent:    number;
    deliveryDaysMin:  number;
    deliveryDaysMax:  number;
  };

  const matched: RawResult[] = [];

  for (const carrier of activeCarriers) {
    const zoneCode = cityToCarrierZoneCode(input.destinationCity, carrier.slug);
    if (!zoneCode) continue;
    const zone = carrier.zones.find((z) => z.zoneCode === zoneCode);
    if (!zone) continue;
    const tier = zone.pricing.find(
      (p) =>
        p.weightMinG <= input.weightG &&
        (p.weightMaxG === null || p.weightMaxG >= input.weightG),
    );
    if (!tier) continue;

    matched.push({
      carrierId:        carrier.id,
      slug:             carrier.slug,
      name:             carrier.name,
      logoUrl:          carrier.logoUrl,
      reliabilityScore: carrier.reliabilityScore,
      priceMad:         tier.priceMad,
      codFeeMad:        tier.codFeeMad ?? 0,
      codFeePercent:    tier.codFeePercent ? parseFloat(tier.codFeePercent) : 0,
      deliveryDaysMin:  tier.deliveryDaysMin,
      deliveryDaysMax:  tier.deliveryDaysMax,
    });
  }

  if (matched.length === 0) return { results: [], unavailable: [] };

  // ── Hybrid pricing: live rate for Aramex, static DB for others ──────────────
  const unavailable: UnavailableCarrier[] = [];
  const priced: RawResult[] = [];

  await Promise.all(
    matched.map(async (r) => {
      if (r.slug === "aramex") {
        try {
          const adapter = getAdapter("aramex") as AramexAdapter;
          const { totalMad } = await Promise.race([
            adapter.calculateRate(
              input.originCity,
              input.destinationCity,
              input.weightG,
              input.codAmountMad,
            ),
            raceTimeout(3000),
          ]);
          // Override DB priceMad with live rate (Aramex returns MAD float → centimes)
          priced.push({ ...r, priceMad: Math.round(totalMad * 100) });
        } catch {
          // Timeout or SOAP error — exclude Aramex from ranked results
          unavailable.push({ slug: r.slug, name: r.name, reason: "rate_unavailable" });
        }
      } else {
        priced.push(r);
      }
    }),
  );

  if (priced.length === 0) return { results: [], unavailable };

  // ── Ranking ────────────────────────────────────────────────────────────────
  const costs = priced.map(
    (r) =>
      r.priceMad +
      r.codFeeMad +
      Math.round((r.codFeePercent / 100) * input.codAmountMad),
  );
  const speeds    = priced.map((r) => r.deliveryDaysMin);
  const relScores = priced.map((r) => r.reliabilityScore);

  const minCost  = Math.min(...costs);
  const maxCost  = Math.max(...costs);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const minRel   = Math.min(...relScores);
  const maxRel   = Math.max(...relScores);

  const normalize = (val: number, min: number, max: number, invert: boolean): number => {
    if (max === min) return 1;
    const n = (val - min) / (max - min);
    return invert ? 1 - n : n;
  };

  const weights = MODE_WEIGHTS[input.mode];

  const results: CarrierResult[] = priced.map((r, i) => {
    const totalCost  = costs[i];
    const costScore  = normalize(totalCost, minCost, maxCost, true);
    const speedScore = normalize(r.deliveryDaysMin, minSpeed, maxSpeed, true);
    const relScore   = normalize(r.reliabilityScore, minRel, maxRel, false);

    const score =
      costScore  * weights.cost +
      speedScore * weights.speed +
      relScore   * weights.reliability;

    const percentFee = Math.round((r.codFeePercent / 100) * input.codAmountMad);

    return {
      carrierId:        r.carrierId,
      slug:             r.slug,
      name:             r.name,
      logoUrl:          r.logoUrl,
      totalCostMad:     totalCost,
      deliveryDaysMin:  r.deliveryDaysMin,
      deliveryDaysMax:  r.deliveryDaysMax,
      reliabilityScore: r.reliabilityScore,
      score:            Math.round(score * 1000) / 1000,
      codFeeBreakdown: {
        flatMad:    r.codFeeMad,
        percentFee,
        total:      r.codFeeMad + percentFee,
      },
    };
  });

  results.sort((a, b) => b.score - a.score);
  return { results, unavailable };
}
