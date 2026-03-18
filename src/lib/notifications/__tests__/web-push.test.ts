import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails:  vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { sendWebPushToUser } from "../web-push";
import webpush from "web-push";
import { db } from "@/lib/db";

describe("sendWebPushToUser", () => {
  const originalPublic  = process.env.VAPID_PUBLIC_KEY;
  const originalPrivate = process.env.VAPID_PRIVATE_KEY;

  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    process.env.VAPID_PUBLIC_KEY  = originalPublic;
    process.env.VAPID_PRIVATE_KEY = originalPrivate;
  });

  it("returns early and skips send when VAPID keys are absent", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    await sendWebPushToUser("user-1", "ship-1", { title: "Test", body: "Body" });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns early when user has no subscriptions", async () => {
    process.env.VAPID_PUBLIC_KEY  = "fake-public-key";
    process.env.VAPID_PRIVATE_KEY = "fake-private-key";

    // db.select returns empty array (already the default mock)
    await sendWebPushToUser("user-1", "ship-1", { title: "Test", body: "Body" });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("calls sendNotification and logs sent for each subscription", async () => {
    process.env.VAPID_PUBLIC_KEY  = "fake-public-key";
    process.env.VAPID_PRIVATE_KEY = "fake-private-key";

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { endpoint: "https://push.example.com/sub1", p256dh: "key1", auth: "auth1" },
        ]),
      }),
    } as never);

    vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as never);

    await sendWebPushToUser("user-1", "ship-1", { title: "Colis", body: "Mis à jour" });

    expect(webpush.sendNotification).toHaveBeenCalledOnce();
    expect(db.insert).toHaveBeenCalledOnce(); // notifications log
  });

  it("deletes stale subscription on 410 Gone and logs failed", async () => {
    process.env.VAPID_PUBLIC_KEY  = "fake-public-key";
    process.env.VAPID_PRIVATE_KEY = "fake-private-key";

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { endpoint: "https://push.example.com/stale", p256dh: "key1", auth: "auth1" },
        ]),
      }),
    } as never);

    const err = Object.assign(new Error("Gone"), { statusCode: 410 });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(err);

    await sendWebPushToUser("user-1", "ship-1", { title: "Test", body: "Body" });

    expect(db.delete).toHaveBeenCalledOnce(); // stale sub removed
    expect(db.insert).toHaveBeenCalledOnce(); // notifications log (failed)
  });
});
