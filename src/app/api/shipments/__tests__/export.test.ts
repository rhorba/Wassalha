import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { GET } from "@/app/api/shipments/export/route";

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

describe("GET /api/shipments/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const req = new Request("http://localhost/api/shipments/export");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns CSV content-type for authenticated user", async () => {
    mockAuth("user-1", "retailer");
    mockEmptySelect();

    const req = new Request("http://localhost/api/shipments/export");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("returns headers-only CSV when no rows match", async () => {
    mockAuth("user-1", "retailer");
    mockEmptySelect();

    const req  = new Request("http://localhost/api/shipments/export");
    const res  = await GET(req);
    const body = await res.text();

    expect(body).toContain("id,date,recipient");
    expect(body.split("\n")).toHaveLength(1); // headers only
  });

  it("sets Content-Disposition attachment header", async () => {
    mockAuth("user-1", "retailer");
    mockEmptySelect();

    const req = new Request("http://localhost/api/shipments/export");
    const res = await GET(req);

    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("wassalha-shipments-");
  });
});
