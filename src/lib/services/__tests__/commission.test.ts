import { describe, it, expect } from "vitest";
import { calculateCommission } from "../commission";

describe("calculateCommission", () => {
  it("applies 10% shipping fee + 1.5% COD fee", () => {
    const result = calculateCommission(1500, 10000);
    expect(result.shippingFeePercent).toBe(10);
    expect(result.shippingFeeAmountMad).toBe(150);   // 10% of 1500
    expect(result.codFeePercent).toBe(1.5);
    expect(result.codFeeAmountMad).toBe(150);         // 1.5% of 10000
    expect(result.totalCommissionMad).toBe(300);
  });

  it("returns all zeros when both inputs are 0", () => {
    const result = calculateCommission(0, 0);
    expect(result.shippingFeeAmountMad).toBe(0);
    expect(result.codFeeAmountMad).toBe(0);
    expect(result.totalCommissionMad).toBe(0);
  });

  it("rounds fractional centimes correctly", () => {
    // 10% of 999 = 99.9 → rounds to 100
    // 1.5% of 1 = 0.015 → rounds to 0
    const result = calculateCommission(999, 1);
    expect(result.shippingFeeAmountMad).toBe(100);
    expect(result.codFeeAmountMad).toBe(0);
    expect(result.totalCommissionMad).toBe(100);
  });

  it("handles typical Morocco COD shipment (2000 MAD COD, 1800 shipping)", () => {
    const result = calculateCommission(1800, 200000);
    expect(result.shippingFeeAmountMad).toBe(180);   // 10% of 1800
    expect(result.codFeeAmountMad).toBe(3000);        // 1.5% of 200000
    expect(result.totalCommissionMad).toBe(3180);
  });

  it("returns correct rate values in breakdown", () => {
    const result = calculateCommission(5000, 50000);
    expect(result.shippingFeePercent).toBe(10);
    expect(result.codFeePercent).toBe(1.5);
  });
});
