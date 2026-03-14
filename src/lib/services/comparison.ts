import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { cityToCarrierZoneCode, isCityKnown } from "@/lib/carriers/city-zones";
import type { CompareInput, CarrierResult } from "@/lib/validations/carriers";

const MODE_WEIGHTS = {
  cheapest: { cost: 0.7, speed: 0.2, reliability: 0.1 },
  balanced: { cost: 0.4, speed: 0.3, reliability: 0.3 },
  fastest:  { cost: 0.2, speed: 0.5, reliability: 0.3 },
} as const;

export type CompareError =
  | { code: "CITY_NOT_FOUND"; field: "originCity" | "destinationCity" }
  | { code: "NO_RESULTS" };

export async function compareCarriers(
  input: CompareInput
): Promise<{ results: CarrierResult[] } | { error: CompareError }> {
  // 1. Validate destination city exists in static map
  if (!isCityKnown(input.destinationCity)) {
    return { error: { code: "CITY_NOT_FOUND", field: "destinationCity" } };
  }

  // 2. Fetch all active carriers with their zones + pricing
  const activeCarriers = await db.query.carriers.findMany({
    where: eq(carriers.isActive, true),
    with: {
      zones: {
        with: { pricing: true },
      },
    },
  });

  // 3. For each carrier, resolve its zone code for the destination city,
  //    find the matching zone + pricing tier by weight.
  type RawResult = {
    carrierId:        string;
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
    // Look up this carrier's zone code for the destination city
    const zoneCode = cityToCarrierZoneCode(input.destinationCity, carrier.slug);

    // Carrier doesn't cover this city — skip silently
    if (!zoneCode) continue;

    // Find the zone row matching the resolved code
    const zone = carrier.zones.find((z) => z.zoneCode === zoneCode);
    if (!zone) continue;

    // Find pricing tier: weightMinG <= input.weightG AND (weightMaxG IS NULL OR weightMaxG >= input.weightG)
    const tier = zone.pricing.find(
      (p) =>
        p.weightMinG <= input.weightG &&
        (p.weightMaxG === null || p.weightMaxG >= input.weightG)
    );

    // No tier matches this weight — skip silently
    if (!tier) continue;

    const flatMad        = tier.codFeeMad ?? 0;
    const percentFeeRate = tier.codFeePercent ? parseFloat(tier.codFeePercent) : 0;

    matched.push({
      carrierId:        carrier.id,
      name:             carrier.name,
      logoUrl:          carrier.logoUrl,
      reliabilityScore: carrier.reliabilityScore,
      priceMad:         tier.priceMad,
      codFeeMad:        flatMad,
      codFeePercent:    percentFeeRate,
      deliveryDaysMin:  tier.deliveryDaysMin,
      deliveryDaysMax:  tier.deliveryDaysMax,
    });
  }

  if (matched.length === 0) return { results: [] };

  // 4. Compute total costs (needed for normalization)
  const costs = matched.map(
    (r) =>
      r.priceMad +
      r.codFeeMad +
      Math.round((r.codFeePercent / 100) * input.codAmountMad)
  );
  const speeds    = matched.map((r) => r.deliveryDaysMin);
  const relScores = matched.map((r) => r.reliabilityScore);

  const minCost  = Math.min(...costs);
  const maxCost  = Math.max(...costs);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const minRel   = Math.min(...relScores);
  const maxRel   = Math.max(...relScores);

  // Min-max normalize: returns 0–1. invert=true means lower raw value → higher score.
  const normalize = (val: number, min: number, max: number, invert: boolean): number => {
    if (max === min) return 1; // all same — no differentiation
    const n = (val - min) / (max - min);
    return invert ? 1 - n : n;
  };

  const weights = MODE_WEIGHTS[input.mode];

  // 5. Score each carrier and build output
  const results: CarrierResult[] = matched.map((r, i) => {
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

  // 6. Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return { results };
}
