import { describe, it, expect } from "vitest";
import { CarrierApiError } from "../types";

describe("CarrierApiError", () => {
  it("is an instance of Error", () => {
    const err = new CarrierApiError("AUTH_FAILED", "auth failed");
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to CarrierApiError", () => {
    const err = new CarrierApiError("SERVICE_UNAVAILABLE", "down");
    expect(err.name).toBe("CarrierApiError");
  });

  it("stores the code", () => {
    const err = new CarrierApiError("INVALID_ADDRESS", "bad addr");
    expect(err.code).toBe("INVALID_ADDRESS");
  });

  it("stores the message", () => {
    const err = new CarrierApiError("UNKNOWN", "something went wrong");
    expect(err.message).toBe("something went wrong");
  });

  it("supports all valid error codes", () => {
    const codes = ["AUTH_FAILED", "INVALID_ADDRESS", "SERVICE_UNAVAILABLE", "UNKNOWN"] as const;
    for (const code of codes) {
      const err = new CarrierApiError(code, "test");
      expect(err.code).toBe(code);
    }
  });
});
