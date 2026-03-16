import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { GET } from "@/app/api/commissions/export/route";

type AuthResult = Awaited<ReturnType<typeof auth>>;

const mockAuth = (userId: string | null, role = "retailer") =>
  vi.mocked(auth).mockResolvedValue({
    userId,
    sessionClaims: userId ? { metadata: { role } } : null,
  } as unknown as AuthResult);

const mockEmptySelect = () =>
  vi.mocked(db.select).mockReturnValue({
    from:     vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  } as never);

describe("GET /api/commissions/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const req = new Request("http://localhost/api/commissions/export");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for retailer role", async () => {
    mockAuth("user-1", "retailer");
    const req = new Request("http://localhost/api/commissions/export");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns CSV content-type for admin", async () => {
    mockAuth("admin-1", "admin");
    mockEmptySelect();

    const req = new Request("http://localhost/api/commissions/export");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("returns headers-only CSV when no rows match", async () => {
    mockAuth("admin-1", "admin");
    mockEmptySelect();

    const req  = new Request("http://localhost/api/commissions/export");
    const res  = await GET(req);
    const body = await res.text();

    expect(body).toContain("id,date,retailer_email");
    expect(body.split("\n")).toHaveLength(1);
  });
});
