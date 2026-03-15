import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
  delete process.env.ARAMEX_API_URL;
  delete process.env.ARAMEX_USERNAME;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("AramexAdapter.getTrackingStatus", () => {
  it("throws SERVICE_UNAVAILABLE when credentials missing", async () => {
    // Import fresh to pick up cleared env vars
    const { AramexAdapter } = await import("../aramex");
    const adapter = new AramexAdapter();
    await expect(adapter.getTrackingStatus("TRK123")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("returns empty array when carrier returns no events", async () => {
    process.env.ARAMEX_API_URL  = "https://sandbox.aramex.net";
    process.env.ARAMEX_USERNAME = "testuser";

    const { AramexAdapter } = await import("../aramex");
    const adapter = new AramexAdapter();

    vi.mocked(global.fetch).mockResolvedValue({
      ok:   true,
      json: async () => ({
        HasErrors:       false,
        TrackingResults: [{ Value: [] }],
      }),
    } as Response);

    const events = await adapter.getTrackingStatus("TRK123");
    expect(events).toHaveLength(0);
  });

  it("normalizes Aramex status codes to shipment status enum", async () => {
    process.env.ARAMEX_API_URL  = "https://sandbox.aramex.net";
    process.env.ARAMEX_USERNAME = "testuser";

    const { AramexAdapter } = await import("../aramex");
    const adapter = new AramexAdapter();

    vi.mocked(global.fetch).mockResolvedValue({
      ok:   true,
      json: async () => ({
        HasErrors: false,
        TrackingResults: [
          {
            Value: [
              {
                UpdateCode:        "SH005",
                UpdateDescription: "Shipment Picked Up",
                UpdateDateTime:    "2026-03-15T09:00:00Z",
                UpdateLocation:    "Casablanca",
              },
              {
                UpdateCode:        "SH006",
                UpdateDescription: "Shipment Delivered",
                UpdateDateTime:    "2026-03-16T14:30:00Z",
                UpdateLocation:    "Rabat",
              },
            ],
          },
        ],
      }),
    } as Response);

    const events = await adapter.getTrackingStatus("TRK123");
    expect(events).toHaveLength(2);
    expect(events[0].status).toBe("picked_up");
    expect(events[0].location).toBe("Casablanca");
    expect(events[1].status).toBe("delivered");
    expect(events[1].carrierRawStatus).toBe("SH006");
  });

  it("throws AUTH_FAILED on 401 response", async () => {
    process.env.ARAMEX_API_URL  = "https://sandbox.aramex.net";
    process.env.ARAMEX_USERNAME = "testuser";

    const { AramexAdapter } = await import("../aramex");
    const adapter = new AramexAdapter();

    vi.mocked(global.fetch).mockResolvedValue({
      ok:     false,
      status: 401,
    } as Response);

    await expect(adapter.getTrackingStatus("TRK123")).rejects.toMatchObject({
      code: "AUTH_FAILED",
    });
  });
});
