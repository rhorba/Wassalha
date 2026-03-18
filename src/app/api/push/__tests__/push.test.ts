import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { auth } from "@clerk/nextjs/server";
import { GET } from "@/app/api/push/vapid-public-key/route";
import { POST, DELETE } from "@/app/api/push/subscribe/route";

type AuthResult = Awaited<ReturnType<typeof auth>>;

const mockAuth = (userId: string | null) =>
  vi.mocked(auth).mockResolvedValue({ userId } as unknown as AuthResult);

describe("GET /api/push/vapid-public-key", () => {
  const originalKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalKey;
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 503 when VAPID key is not configured", async () => {
    mockAuth("user-1");
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns 200 with the VAPID public key", async () => {
    mockAuth("user-1");
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-key";
    const res  = await GET();
    const body = await res.json() as { key: string };
    expect(res.status).toBe(200);
    expect(body.key).toBe("test-vapid-key");
  });
});

describe("POST /api/push/subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const req = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body:   JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    mockAuth("user-1");
    const req = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body:   JSON.stringify({ endpoint: "not-a-url" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid subscription", async () => {
    mockAuth("user-1");
    const req = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body:   JSON.stringify({
        endpoint: "https://push.example.com/subscription",
        keys:     { p256dh: "key123", auth: "auth123" },
      }),
    });
    const res  = await POST(req);
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

describe("DELETE /api/push/subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const req = new Request("http://localhost/api/push/subscribe", {
      method: "DELETE",
      body:   JSON.stringify({ endpoint: "https://push.example.com/sub" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    mockAuth("user-1");
    const req = new Request("http://localhost/api/push/subscribe", {
      method: "DELETE",
      body:   JSON.stringify({ endpoint: "not-a-url" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid endpoint", async () => {
    mockAuth("user-1");
    const req = new Request("http://localhost/api/push/subscribe", {
      method: "DELETE",
      body:   JSON.stringify({ endpoint: "https://push.example.com/subscription" }),
    });
    const res  = await DELETE(req);
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
