import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      shipments: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      trackingEvents: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    insert:  vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn() }) }),
    update:  vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
  },
}));

vi.mock("@/lib/carriers/adapters", () => ({
  getAdapter: vi.fn(),
}));

import { pollActiveShipments, getTrackingEvents } from "../tracking";
import { getAdapter } from "@/lib/carriers/adapters";
import { db } from "@/lib/db";

describe("pollActiveShipments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns { processed: 0, errors: 0 } when no active shipments", async () => {
    const result = await pollActiveShipments();
    expect(result).toMatchObject({ processed: 0, errors: 0 });
  });

  it("counts errors without throwing when adapter fails", async () => {
    vi.mocked(db.query.shipments.findMany).mockResolvedValueOnce([
      {
        id:                    "ship-1",
        carrierTrackingNumber: "TRK-001",
        status:                "in_transit",
        carrier:               { slug: "aramex" },
      },
    ] as never);

    vi.mocked(getAdapter).mockReturnValue({
      slug:              "aramex",
      createShipment:    vi.fn(),
      getTrackingStatus: vi.fn().mockRejectedValue(new Error("network error")),
    });

    const result = await pollActiveShipments();
    expect(result.errors).toBe(1);
    expect(result.processed).toBe(1);
  });

  it("skips shipments without tracking number", async () => {
    vi.mocked(db.query.shipments.findMany).mockResolvedValueOnce([
      {
        id:                    "ship-2",
        carrierTrackingNumber: null,
        status:                "confirmed",
        carrier:               { slug: "ctm" },
      },
    ] as never);

    const result = await pollActiveShipments();
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    expect(getAdapter).not.toHaveBeenCalled();
  });
});

describe("getTrackingEvents", () => {
  it("returns events ordered by occurredAt", async () => {
    vi.mocked(db.query.trackingEvents.findMany).mockResolvedValueOnce([
      { id: "evt-1", status: "confirmed", occurredAt: new Date("2026-03-15T09:00:00Z") },
    ] as never);

    const events = await getTrackingEvents("ship-1");
    expect(events).toHaveLength(1);
  });
});
