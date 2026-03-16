import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB before importing service
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

import { getAnalyticsSummary, getAnalyticsCharts } from "../analytics";
import { db } from "@/lib/db";

// Helper to build a chainable select mock that resolves with a given value
function mockSelect(returnValue: unknown[]) {
  const chain = {
    from:      vi.fn(),
    where:     vi.fn(),
    leftJoin:  vi.fn(),
    groupBy:   vi.fn(),
    then:      undefined as unknown,
  };
  // Make every method return the chain so we can call .from().where() etc.
  chain.from     = vi.fn().mockReturnValue(chain);
  chain.where    = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.groupBy  = vi.fn().mockReturnValue(chain);
  // Make the chain itself thenable (a Promise-like)
  Object.assign(chain, Promise.resolve(returnValue));
  (chain as unknown as Promise<unknown[]>)[Symbol.iterator as never] =
    returnValue[Symbol.iterator as never];
  return chain;
}

describe("getAnalyticsSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeroed summary when no shipments exist", async () => {
    vi.mocked(db.select)
      // First call: shipments aggregate
      .mockReturnValueOnce({
        from:  vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { total: 0, active: 0, delivered: 0, totalSpend: 0, totalCod: 0 },
          ]),
        }),
      } as never)
      // Second call: commissions aggregate
      .mockReturnValueOnce({
        from:  vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { paid: 0, pending: 0, invoiced: 0 },
            ]),
          }),
        }),
      } as never);

    const result = await getAnalyticsSummary("user-1", "retailer");

    expect(result.totalShipments).toBe(0);
    expect(result.activeShipments).toBe(0);
    expect(result.successRate).toBe(0);
    expect(result.totalSpendMad).toBe(0);
    expect(result.pipeline).toBeNull();
  });

  it("computes successRate correctly", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { total: 10, active: 3, delivered: 8, totalSpend: 50000, totalCod: 200000 },
          ]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ paid: 5000, pending: 2000, invoiced: 1000 }]),
          }),
        }),
      } as never);

    const result = await getAnalyticsSummary("user-1", "retailer");
    expect(result.successRate).toBe(80); // 8/10 = 80%
  });

  it("converts centimes to MAD (÷100)", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { total: 1, active: 0, delivered: 1, totalSpend: 123450, totalCod: 500000 },
          ]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ paid: 10000, pending: 0, invoiced: 0 }]),
          }),
        }),
      } as never);

    const result = await getAnalyticsSummary("user-1", "retailer");
    expect(result.totalSpendMad).toBe(1234.5);
    expect(result.totalCodMad).toBe(5000);
    expect(result.commissionPaidMad).toBe(100);
  });

  it("returns pipeline object for admin role", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { total: 5, active: 1, delivered: 3, totalSpend: 10000, totalCod: 50000 },
          ]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ paid: 3000, pending: 7000, invoiced: 2000 }]),
          }),
        }),
      } as never);

    const result = await getAnalyticsSummary("admin-1", "admin");
    expect(result.pipeline).not.toBeNull();
    expect(result.pipeline?.pendingMad).toBe(70);
    expect(result.pipeline?.invoicedMad).toBe(20);
    expect(result.pipeline?.paidMad).toBe(30);
  });

  it("returns null pipeline for retailer role", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { total: 0, active: 0, delivered: 0, totalSpend: 0, totalCod: 0 },
          ]),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ paid: 0, pending: 0, invoiced: 0 }]),
          }),
        }),
      } as never);

    const result = await getAnalyticsSummary("user-1", "retailer");
    expect(result.pipeline).toBeNull();
  });
});

describe("getAnalyticsCharts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty arrays when no data in range", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as never);
    vi.mocked(db.select).mockReturnValueOnce({
      from:     vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where:   vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never);

    const result = await getAnalyticsCharts(
      "user-1",
      "retailer",
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );

    expect(result.timeSeries).toHaveLength(0);
    expect(result.carrierBreakdown).toHaveLength(0);
  });

  it("converts carrier breakdown centimes to MAD", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as never);
    vi.mocked(db.select).mockReturnValueOnce({
      from:     vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where:   vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { carrier: "Aramex", count: 5, spend: 75000 },
              { carrier: null,     count: 2, spend: 20000 },
            ]),
          }),
        }),
      }),
    } as never);

    const result = await getAnalyticsCharts(
      "user-1",
      "retailer",
      new Date("2026-01-01"),
      new Date("2026-03-16"),
    );

    expect(result.carrierBreakdown).toHaveLength(2);
    expect(result.carrierBreakdown[0].spendMad).toBe(750);
    expect(result.carrierBreakdown[1].carrier).toBe("Unknown"); // null → "Unknown"
  });
});
