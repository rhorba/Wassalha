import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics", () => ({
  getAnalyticsSummary: vi.fn(),
  getAnalyticsCharts:  vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import * as analyticsService from "@/lib/services/analytics";
import { GET as summaryGET } from "@/app/api/analytics/summary/route";
import { GET as chartsGET  } from "@/app/api/analytics/charts/route";

type AuthResult = Awaited<ReturnType<typeof auth>>;

const mockAuth = (userId: string | null, role = "retailer") =>
  vi.mocked(auth).mockResolvedValue({
    userId,
    sessionClaims: userId ? { metadata: { role } } : null,
  } as unknown as AuthResult);

const mockSummary = {
  totalShipments: 5, activeShipments: 2, deliveredCount: 3,
  successRate: 60, totalSpendMad: 100, totalCodMad: 500,
  commissionPaidMad: 10, pipeline: null,
};

const mockCharts = { timeSeries: [], carrierBreakdown: [] };

describe("GET /api/analytics/summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const res = await summaryGET();
    expect(res.status).toBe(401);
  });

  it("returns summary object for authenticated retailer", async () => {
    mockAuth("user-1", "retailer");
    vi.mocked(analyticsService.getAnalyticsSummary).mockResolvedValue(mockSummary);

    const res  = await summaryGET();
    const body = await res.json() as typeof mockSummary;

    expect(res.status).toBe(200);
    expect(body.totalShipments).toBe(5);
    expect(body.pipeline).toBeNull();
  });

  it("returns pipeline data for admin", async () => {
    mockAuth("admin-1", "admin");
    vi.mocked(analyticsService.getAnalyticsSummary).mockResolvedValue({
      ...mockSummary,
      pipeline: { pendingMad: 100, invoicedMad: 50, paidMad: 30 },
    });

    const res  = await summaryGET();
    const body = await res.json() as typeof mockSummary & { pipeline: unknown };
    expect(body.pipeline).not.toBeNull();
  });
});

describe("GET /api/analytics/charts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const req = new Request("http://localhost/api/analytics/charts");
    const res = await chartsGET(req);
    expect(res.status).toBe(401);
  });

  it("returns timeSeries and carrierBreakdown arrays", async () => {
    mockAuth("user-1", "retailer");
    vi.mocked(analyticsService.getAnalyticsCharts).mockResolvedValue(mockCharts);

    const req = new Request("http://localhost/api/analytics/charts");
    const res = await chartsGET(req);
    const body = await res.json() as typeof mockCharts;

    expect(res.status).toBe(200);
    expect(Array.isArray(body.timeSeries)).toBe(true);
    expect(Array.isArray(body.carrierBreakdown)).toBe(true);
  });
});
