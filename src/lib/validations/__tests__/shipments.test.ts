import { describe, it, expect } from "vitest";
import { BookingInputSchema } from "../shipments";

const validInput = {
  carrierId:        "550e8400-e29b-41d4-a716-446655440000",
  shippingCostMad:  1500,
  mode:             "balanced" as const,
  originCity:       "Casablanca",
  recipientName:    "Mohammed Benali",
  recipientPhone:   "+212612345678",
  recipientCity:    "Marrakech",
  recipientAddress: "12 Rue Ibn Battouta, Agdal",
  weightG:          500,
  codAmountMad:     20000,
};

describe("BookingInputSchema", () => {
  it("accepts a valid booking input", () => {
    const result = BookingInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts optional parcelDescription", () => {
    const result = BookingInputSchema.safeParse({
      ...validInput,
      parcelDescription: "Vêtements",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing recipientName", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, recipientName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid phone number", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, recipientPhone: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.recipientPhone).toBeDefined();
    }
  });

  it("rejects negative codAmountMad", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, codAmountMad: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid carrierId", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, carrierId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects recipientAddress shorter than 5 chars", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, recipientAddress: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, mode: "express" });
    expect(result.success).toBe(false);
  });

  it("rejects weightG of 0", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, weightG: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects shippingCostMad of 0", () => {
    const result = BookingInputSchema.safeParse({ ...validInput, shippingCostMad: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts phone without country code prefix", () => {
    const result = BookingInputSchema.safeParse({
      ...validInput,
      recipientPhone: "0612345678",
    });
    expect(result.success).toBe(true);
  });
});
