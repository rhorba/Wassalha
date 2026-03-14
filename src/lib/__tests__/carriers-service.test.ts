import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      carriers: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      carrierZones: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import {
  listCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  softDeleteCarrier,
  getCarrierBySlug,
  createZone,
  deleteZone,
  createPricing,
  deletePricing,
} from "@/lib/services/carriers";

const mockCarrier = {
  id: "uuid-1",
  name: "Amana",
  slug: "amana",
  logoUrl: null,
  isActive: true,
  reliabilityScore: 80,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockZone = {
  id: "zone-uuid-1",
  carrierId: "uuid-1",
  zoneName: "Grand Casablanca",
  zoneCode: "ZA",
  createdAt: new Date(),
};

const mockPricing = {
  id: "pricing-uuid-1",
  zoneId: "zone-uuid-1",
  weightMinG: 0,
  weightMaxG: 500,
  priceMad: 2500,
  deliveryDaysMin: 1,
  deliveryDaysMax: 2,
  createdAt: new Date(),
};

// Helper to mock chained Drizzle calls: db.insert(table).values(...).returning()
function mockInsertChain(returnValue: unknown) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  vi.mocked(db.insert).mockReturnValue(
    { values: valuesMock } as unknown as ReturnType<typeof db.insert>
  );
  return { returningMock, valuesMock };
}

function mockUpdateChain(returnValue: unknown) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  vi.mocked(db.update).mockReturnValue(
    { set: setMock } as unknown as ReturnType<typeof db.update>
  );
  return { returningMock, whereMock, setMock };
}

function mockDeleteChain(returnValue: unknown) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  vi.mocked(db.delete).mockReturnValue(
    { where: whereMock } as unknown as ReturnType<typeof db.delete>
  );
  return { returningMock, whereMock };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCarriers", () => {
  it("returns active carriers ordered by name", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([mockCarrier]);
    const result = await listCarriers();
    expect(db.query.carriers.findMany).toHaveBeenCalledOnce();
    expect(result).toEqual([mockCarrier]);
  });
});

describe("getCarrierById", () => {
  it("returns carrier with zones and pricing", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(
      {
        ...mockCarrier,
        zones: [{ ...mockZone, pricing: [mockPricing] }],
      } as unknown as Awaited<ReturnType<typeof db.query.carriers.findFirst>>
    );
    const result = await getCarrierById("uuid-1");
    expect(result?.id).toBe("uuid-1");
    expect((result as unknown as { zones: unknown[] })?.zones).toHaveLength(1);
  });

  it("returns undefined for non-existent id", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(undefined);
    const result = await getCarrierById("non-existent");
    expect(result).toBeUndefined();
  });
});

describe("createCarrier", () => {
  it("inserts and returns new carrier", async () => {
    mockInsertChain(mockCarrier);
    const result = await createCarrier({ name: "Amana", slug: "amana" });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockCarrier);
  });
});

describe("updateCarrier", () => {
  it("updates carrier and sets updatedAt", async () => {
    mockUpdateChain(mockCarrier);
    const result = await updateCarrier("uuid-1", { name: "Amana Updated" });
    expect(db.update).toHaveBeenCalledOnce();
    expect(result).toEqual(mockCarrier);
  });
});

describe("softDeleteCarrier", () => {
  it("sets isActive=false", async () => {
    mockUpdateChain({ ...mockCarrier, isActive: false });
    const result = await softDeleteCarrier("uuid-1");
    expect(result.isActive).toBe(false);
  });
});

describe("getCarrierBySlug", () => {
  it("returns carrier when slug exists", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(mockCarrier);
    const result = await getCarrierBySlug("amana");
    expect(result).toEqual(mockCarrier);
  });

  it("returns undefined when slug not found", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(undefined);
    const result = await getCarrierBySlug("unknown");
    expect(result).toBeUndefined();
  });
});

describe("createZone", () => {
  it("inserts zone with carrierId", async () => {
    mockInsertChain(mockZone);
    const result = await createZone("uuid-1", {
      zoneName: "Grand Casablanca",
      zoneCode: "ZA",
    });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockZone);
  });
});

describe("deleteZone", () => {
  it("deletes zone by id", async () => {
    mockDeleteChain(mockZone);
    const result = await deleteZone("zone-uuid-1");
    expect(db.delete).toHaveBeenCalledOnce();
    expect(result).toEqual(mockZone);
  });
});

describe("createPricing", () => {
  it("inserts pricing row with zoneId", async () => {
    mockInsertChain(mockPricing);
    const result = await createPricing("zone-uuid-1", {
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockPricing);
  });
});

describe("deletePricing", () => {
  it("deletes pricing row by id", async () => {
    mockDeleteChain(mockPricing);
    const result = await deletePricing("pricing-uuid-1");
    expect(db.delete).toHaveBeenCalledOnce();
    expect(result).toEqual(mockPricing);
  });
});
