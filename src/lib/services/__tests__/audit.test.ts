import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { logAuditEvent } from "../audit";
import { db } from "@/lib/db";

describe("logAuditEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts an audit log row with correct params", async () => {
    await logAuditEvent({
      actorId:    "user_123",
      actorRole:  "admin",
      action:     "carrier.create",
      targetType: "carrier",
      targetId:   "carrier-uuid",
    });

    expect(db.insert).toHaveBeenCalledOnce();
    const valuesMock = vi.mocked(db.insert).mock.results[0].value.values;
    expect(valuesMock).toHaveBeenCalledWith({
      actorId:    "user_123",
      actorRole:  "admin",
      action:     "carrier.create",
      targetType: "carrier",
      targetId:   "carrier-uuid",
    });
  });

  it("never throws when DB insert fails", async () => {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    } as never);

    await expect(
      logAuditEvent({
        actorId:    "user_123",
        actorRole:  "admin",
        action:     "carrier.delete",
        targetType: "carrier",
        targetId:   "carrier-uuid",
      }),
    ).resolves.toBeUndefined();
  });
});
