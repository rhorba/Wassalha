import { describe, it, expect } from "vitest";
import { UserProfileSchema, UserProfilePatchSchema } from "../users";

describe("UserProfileSchema", () => {
  it("accepts a fully valid profile", () => {
    const result = UserProfileSchema.safeParse({
      businessName:         "Mon Commerce",
      phone:                "+212612345678",
      defaultSenderAddress: "12 Rue Ibn Battouta, Casablanca",
      defaultSenderCity:    "Casablanca",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid phone number", () => {
    const result = UserProfileSchema.safeParse({
      businessName:         "Mon Commerce",
      phone:                "not-a-phone",
      defaultSenderAddress: "12 Rue Ibn Battouta",
      defaultSenderCity:    "Casablanca",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("phone");
    }
  });

  it("rejects an address shorter than 5 characters", () => {
    const result = UserProfileSchema.safeParse({
      businessName:         "Mon Commerce",
      phone:                "+212612345678",
      defaultSenderAddress: "abc",
      defaultSenderCity:    "Casablanca",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty businessName", () => {
    const result = UserProfileSchema.safeParse({
      businessName:         "",
      phone:                "+212612345678",
      defaultSenderAddress: "12 Rue Ibn Battouta",
      defaultSenderCity:    "Casablanca",
    });
    expect(result.success).toBe(false);
  });
});

describe("UserProfilePatchSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = UserProfilePatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a partial patch — businessName only", () => {
    const result = UserProfilePatchSchema.safeParse({ businessName: "Nouveau Nom" });
    expect(result.success).toBe(true);
  });

  it("accepts a partial patch — city only", () => {
    const result = UserProfilePatchSchema.safeParse({ defaultSenderCity: "Rabat" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid phone even in a partial patch", () => {
    const result = UserProfilePatchSchema.safeParse({ phone: "abc" });
    expect(result.success).toBe(false);
  });
});
