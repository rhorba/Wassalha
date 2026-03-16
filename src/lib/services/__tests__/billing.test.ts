import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update:  vi.fn(),
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

import { createRetailerInvoice } from "../billing";
import { db } from "@/lib/db";

describe("createRetailerInvoice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NO_PENDING_COMMISSIONS when no pending rows exist", async () => {
    // First select: pending commissions query → empty
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from:     vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

    await expect(createRetailerInvoice("user-no-commissions")).rejects.toThrow(
      "NO_PENDING_COMMISSIONS",
    );
  });
});
