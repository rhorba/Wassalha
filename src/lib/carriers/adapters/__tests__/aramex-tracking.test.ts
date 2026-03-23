import { describe, it, expect, vi, beforeEach } from "vitest";
import { CarrierApiError } from "../../types";

// Mock the SOAP utility so tests don't make real HTTP calls
vi.mock("../../aramex-soap", () => ({
  buildClientInfo: vi.fn(() => ""),
  callAramex:      vi.fn(),
}));

import { callAramex } from "../../aramex-soap";
import { AramexAdapter } from "../aramex";

const adapter = new AramexAdapter();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AramexAdapter.getTrackingStatus", () => {
  it("returns empty array when SOAP response has no events", async () => {
    vi.mocked(callAramex).mockResolvedValue({
      HasErrors:       false,
      TrackingResults: [],
    });

    const events = await adapter.getTrackingStatus("TRK123");
    expect(events).toHaveLength(0);
  });

  it("normalizes Aramex status codes to shipment status enum", async () => {
    vi.mocked(callAramex).mockResolvedValue({
      HasErrors:       false,
      TrackingResults: [
        {
          KeyValueOfstringArrayOfTrackingResultmFAkxlpY: {
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
        },
      ],
    });

    const events = await adapter.getTrackingStatus("TRK123");
    expect(events).toHaveLength(2);
    expect(events[0].status).toBe("picked_up");
    expect(events[0].location).toBe("Casablanca");
    expect(events[1].status).toBe("delivered");
    expect(events[1].carrierRawStatus).toBe("SH006");
  });

  it("maps unknown status code to in_transit", async () => {
    vi.mocked(callAramex).mockResolvedValue({
      HasErrors:       false,
      TrackingResults: [
        {
          KeyValueOfstringArrayOfTrackingResultmFAkxlpY: {
            Value: [
              {
                UpdateCode:        "SH999",
                UpdateDescription: "Unknown status",
                UpdateDateTime:    "2026-03-15T09:00:00Z",
              },
            ],
          },
        },
      ],
    });

    const events = await adapter.getTrackingStatus("TRK123");
    expect(events[0].status).toBe("in_transit");
    expect(events[0].carrierRawStatus).toBe("SH999");
  });

  it("propagates CarrierApiError when callAramex throws", async () => {
    vi.mocked(callAramex).mockRejectedValue(
      new CarrierApiError("SERVICE_UNAVAILABLE", "Aramex HTTP 503"),
    );

    await expect(adapter.getTrackingStatus("TRK123")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
