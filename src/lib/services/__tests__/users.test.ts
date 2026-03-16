import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    query: { users: { findFirst: vi.fn() } },
    update: vi.fn(),
  },
}));

import { getUserProfile, updateUserProfile } from "../users";
import { db } from "@/lib/db";

describe("getUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user profile when found", async () => {
    const mockProfile = {
      id:                   "user_123",
      email:                "test@example.com",
      name:                 "Test User",
      role:                 "retailer" as const,
      businessName:         "Mon Commerce",
      phone:                "+212612345678",
      defaultSenderAddress: "12 Rue Ibn Battouta",
      defaultSenderCity:    "Casablanca",
    };
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockProfile as never);

    const result = await getUserProfile("user_123");
    expect(result).toEqual(mockProfile);
    expect(db.query.users.findFirst).toHaveBeenCalledOnce();
  });

  it("returns undefined when user not found", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined);
    const result = await getUserProfile("nonexistent");
    expect(result).toBeUndefined();
  });
});

describe("updateUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update and returns the updated user", async () => {
    const updated = {
      id:           "user_123",
      email:        "test@example.com",
      businessName: "Nouveau Nom",
    };
    const chain = {
      set:     vi.fn(),
      where:   vi.fn(),
      returning: vi.fn().mockResolvedValueOnce([updated]),
    };
    chain.set   = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    vi.mocked(db.update).mockReturnValueOnce(chain as never);

    const result = await updateUserProfile("user_123", { businessName: "Nouveau Nom" });
    expect(result).toEqual(updated);
    expect(db.update).toHaveBeenCalledOnce();
  });
});
