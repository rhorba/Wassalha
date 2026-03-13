import { describe, it, expect } from "vitest";
import {
  CreateCarrierSchema,
  UpdateCarrierSchema,
  CreateZoneSchema,
  CreatePricingSchema,
} from "@/lib/validations/carriers";

// ── CreateCarrierSchema ────────────────────────────────────────────────────────

describe("CreateCarrierSchema", () => {
  it("accepts valid input", () => {
    const result = CreateCarrierSchema.safeParse({
      name: "Amana",
      slug: "amana",
      logoUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts logoUrl as undefined (optional)", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Amana", slug: "amana" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateCarrierSchema.safeParse({ name: "", slug: "amana" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Amana", slug: "Amana" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Amana", slug: "amana express" });
    expect(result.success).toBe(false);
  });

  it("accepts slug with hyphens and numbers", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Fret Express", slug: "fret-express-2" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid logoUrl", () => {
    const result = CreateCarrierSchema.safeParse({
      name: "Amana",
      slug: "amana",
      logoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid logoUrl", () => {
    const result = CreateCarrierSchema.safeParse({
      name: "Amana",
      slug: "amana",
      logoUrl: "https://cdn.example.com/amana.png",
    });
    expect(result.success).toBe(true);
  });
});

// ── UpdateCarrierSchema ────────────────────────────────────────────────────────

describe("UpdateCarrierSchema", () => {
  it("accepts partial input (name only)", () => {
    const result = UpdateCarrierSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no-op patch)", () => {
    const result = UpdateCarrierSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates slug format when provided", () => {
    const result = UpdateCarrierSchema.safeParse({ slug: "Invalid Slug!" });
    expect(result.success).toBe(false);
  });
});

// ── CreateZoneSchema ───────────────────────────────────────────────────────────

describe("CreateZoneSchema", () => {
  it("accepts valid zone", () => {
    const result = CreateZoneSchema.safeParse({ zoneName: "Grand Casablanca", zoneCode: "ZA" });
    expect(result.success).toBe(true);
  });

  it("rejects empty zoneName", () => {
    const result = CreateZoneSchema.safeParse({ zoneName: "", zoneCode: "ZA" });
    expect(result.success).toBe(false);
  });

  it("rejects empty zoneCode", () => {
    const result = CreateZoneSchema.safeParse({ zoneName: "Grand Casablanca", zoneCode: "" });
    expect(result.success).toBe(false);
  });

  it("rejects zoneCode exceeding 20 chars", () => {
    const result = CreateZoneSchema.safeParse({
      zoneName: "Zone",
      zoneCode: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});

// ── CreatePricingSchema ────────────────────────────────────────────────────────

describe("CreatePricingSchema", () => {
  it("accepts valid pricing row (bounded weight)", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null weightMaxG (open-ended tier)", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 1001,
      weightMaxG: null,
      priceMad: 4000,
      deliveryDaysMin: 2,
      deliveryDaysMax: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects weightMaxG <= weightMinG", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 500,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.weightMaxG).toBeDefined();
  });

  it("rejects deliveryDaysMax < deliveryDaysMin", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 3,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.deliveryDaysMax).toBeDefined();
  });

  it("rejects priceMad of 0", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 0,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative weightMinG", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: -1,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
  });
});
