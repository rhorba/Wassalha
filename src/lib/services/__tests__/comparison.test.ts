import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB and city-zones before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      carriers: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/carriers/city-zones", () => ({
  isCityKnown: (city: string) => ["casablanca", "marrakech"].includes(city.toLowerCase().trim()),
  cityToCarrierZoneCode: (city: string, slug: string) => {
    const map: Record<string, Record<string, string>> = {
      casablanca: { amana: "ZA", "fret-express": "NAT" },
      marrakech:  { amana: "ZB", "fret-express": "NAT" },
    };
    return map[city.toLowerCase().trim()]?.[slug];
  },
}));

import { compareCarriers } from "@/lib/services/comparison";
import { db } from "@/lib/db";

// Minimal carrier fixture factory
function makeCarrier(
  id: string,
  slug: string,
  name: string,
  reliabilityScore: number,
  zoneCode: string,
  priceMad: number,
  deliveryDaysMin: number,
  deliveryDaysMax: number
) {
  return {
    id,
    name,
    slug,
    logoUrl: null,
    isActive: true,
    reliabilityScore,
    createdAt: new Date(),
    updatedAt: new Date(),
    zones: [
      {
        id: `zone-${id}`,
        carrierId: id,
        zoneName: "Test Zone",
        zoneCode,
        createdAt: new Date(),
        pricing: [
          {
            id: `pricing-${id}`,
            zoneId: `zone-${id}`,
            weightMinG: 0,
            weightMaxG: null,
            priceMad,
            codFeeMad: null,
            codFeePercent: null,
            deliveryDaysMin,
            deliveryDaysMax,
            createdAt: new Date(),
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("compareCarriers — city validation", () => {
  it("returns CITY_NOT_FOUND for unknown destination", async () => {
    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "unknown-city",
      weightG: 500,
      codAmountMad: 0,
      mode: "balanced",
    });
    expect(result).toEqual({
      error: { code: "CITY_NOT_FOUND", field: "destinationCity" },
    });
  });

  it("does not validate origin city — only destination triggers 422", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([]);
    const result = await compareCarriers({
      originCity: "unknown-city",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "balanced",
    });
    // No error — returns empty results because no carriers found
    expect("results" in result).toBe(true);
  });
});

describe("compareCarriers — results", () => {
  it("returns empty array when no carriers cover zone", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([]);
    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "balanced",
    });
    expect(result).toMatchObject({ results: [] });
  });

  it("ranks cheapest carrier first in cheapest mode", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([
      makeCarrier("1", "amana", "Carrier A", 80, "ZA", 3000, 3, 5),
      makeCarrier("2", "fret-express", "Carrier B", 80, "NAT", 5000, 1, 2),
    ] as never);

    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "cheapest",
    });

    expect("results" in result).toBe(true);
    if ("results" in result) {
      expect(result.results[0].name).toBe("Carrier A");
      expect(result.results[0].totalCostMad).toBe(3000);
    }
  });

  it("ranks fastest carrier first in fastest mode", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([
      makeCarrier("1", "amana", "Carrier A", 80, "ZA", 3000, 3, 5),
      makeCarrier("2", "fret-express", "Carrier B", 80, "NAT", 5000, 1, 2),
    ] as never);

    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "fastest",
    });

    expect("results" in result).toBe(true);
    if ("results" in result) {
      expect(result.results[0].name).toBe("Carrier B");
    }
  });

  it("skips carrier silently when no pricing tier matches weight", async () => {
    const carrierWithRestrictedPricing = {
      ...makeCarrier("1", "amana", "Amana", 80, "ZA", 3000, 1, 2),
      zones: [
        {
          id: "zone-1",
          carrierId: "1",
          zoneName: "Test Zone",
          zoneCode: "ZA",
          createdAt: new Date(),
          pricing: [
            {
              id: "pricing-1",
              zoneId: "zone-1",
              weightMinG: 0,
              weightMaxG: 100, // max 100g — our 500g shipment won't match
              priceMad: 2500,
              codFeeMad: null,
              codFeePercent: null,
              deliveryDaysMin: 1,
              deliveryDaysMax: 2,
              createdAt: new Date(),
            },
          ],
        },
      ],
    };

    vi.mocked(db.query.carriers.findMany).mockResolvedValue([
      carrierWithRestrictedPricing,
    ] as never);

    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "balanced",
    });

    expect(result).toMatchObject({ results: [] });
  });

  it("all same signal values give everyone score=1 per signal", async () => {
    // Two carriers with identical cost + speed + reliability → same score
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([
      makeCarrier("1", "amana", "Carrier A", 80, "ZA", 3000, 2, 3),
      makeCarrier("2", "fret-express", "Carrier B", 80, "NAT", 3000, 2, 3),
    ] as never);

    const result = await compareCarriers({
      originCity: "casablanca",
      destinationCity: "casablanca",
      weightG: 500,
      codAmountMad: 0,
      mode: "balanced",
    });

    expect("results" in result).toBe(true);
    if ("results" in result) {
      expect(result.results[0].score).toBe(result.results[1].score);
    }
  });
});
