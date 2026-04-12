import { describe, it, expect } from "vitest";
import {
  BulkCompareRowSchema,
  BulkCompareRequestSchema,
} from "../carriers";

// ── BulkCompareRowSchema ──────────────────────────────────────────────────────

describe("BulkCompareRowSchema", () => {
  const validRow = {
    rowIndex:        0,
    originCity:      "Casablanca",
    destinationCity: "Marrakech",
    weightG:         500,
    codAmountMad:    1500,
  };

  it("accepts a valid row with numeric values", () => {
    const result = BulkCompareRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it("coerces string weightG and codAmountMad from CSV", () => {
    const result = BulkCompareRowSchema.safeParse({
      ...validRow,
      weightG:      "500",
      codAmountMad: "1500",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weightG).toBe(500);
      expect(result.data.codAmountMad).toBe(1500);
    }
  });

  it("accepts an optional label", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, label: "Order #123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.label).toBe("Order #123");
  });

  it("accepts an optional mode override", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, mode: "cheapest" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBe("cheapest");
  });

  it("mode is undefined when not provided", () => {
    const result = BulkCompareRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBeUndefined();
  });

  it("rejects missing originCity", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, originCity: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing destinationCity", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, destinationCity: "" });
    expect(result.success).toBe(false);
  });

  it("rejects weightG below 1", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, weightG: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative codAmountMad", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, codAmountMad: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode value", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, mode: "express" });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer weightG", () => {
    const result = BulkCompareRowSchema.safeParse({ ...validRow, weightG: 1.5 });
    expect(result.success).toBe(false);
  });
});

// ── BulkCompareRequestSchema ──────────────────────────────────────────────────

describe("BulkCompareRequestSchema", () => {
  const validRow = {
    rowIndex:        0,
    originCity:      "Casablanca",
    destinationCity: "Marrakech",
    weightG:         500,
    codAmountMad:    1500,
  };

  it("accepts a valid request with one row", () => {
    const result = BulkCompareRequestSchema.safeParse({
      globalMode: "balanced",
      rows:       [validRow],
    });
    expect(result.success).toBe(true);
  });

  it("defaults globalMode to balanced when omitted", () => {
    const result = BulkCompareRequestSchema.safeParse({ rows: [validRow] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.globalMode).toBe("balanced");
  });

  it("rejects empty rows array", () => {
    const result = BulkCompareRequestSchema.safeParse({ globalMode: "balanced", rows: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 rows", () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ ...validRow, rowIndex: i }));
    const result = BulkCompareRequestSchema.safeParse({ globalMode: "balanced", rows });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 50 rows", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ ...validRow, rowIndex: i }));
    const result = BulkCompareRequestSchema.safeParse({ globalMode: "balanced", rows });
    expect(result.success).toBe(true);
  });

  it("accepts all valid globalMode values", () => {
    for (const mode of ["cheapest", "balanced", "fastest"] as const) {
      const result = BulkCompareRequestSchema.safeParse({ globalMode: mode, rows: [validRow] });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid globalMode", () => {
    const result = BulkCompareRequestSchema.safeParse({
      globalMode: "express",
      rows:       [validRow],
    });
    expect(result.success).toBe(false);
  });
});
