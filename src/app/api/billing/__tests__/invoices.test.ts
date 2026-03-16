import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/billing", () => ({
  createRetailerInvoice: vi.fn(),
  listInvoices:          vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import * as billingService from "@/lib/services/billing";
import { POST, GET } from "@/app/api/billing/invoices/route";

type AuthResult = Awaited<ReturnType<typeof auth>>;

const mockAuth = (userId: string | null, role = "retailer") =>
  vi.mocked(auth).mockResolvedValue({
    userId,
    sessionClaims: userId ? { metadata: { role } } : null,
  } as unknown as AuthResult);

describe("POST /api/billing/invoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const req = new Request("http://localhost/api/billing/invoices", {
      method: "POST",
      body:   JSON.stringify({ userId: "user-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for retailer role", async () => {
    mockAuth("user-1", "retailer");
    const req = new Request("http://localhost/api/billing/invoices", {
      method: "POST",
      body:   JSON.stringify({ userId: "user-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when userId is missing", async () => {
    mockAuth("admin-1", "admin");
    const req = new Request("http://localhost/api/billing/invoices", {
      method: "POST",
      body:   JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when no pending commissions", async () => {
    mockAuth("admin-1", "admin");
    vi.mocked(billingService.createRetailerInvoice).mockRejectedValue(
      new Error("NO_PENDING_COMMISSIONS"),
    );
    const req = new Request("http://localhost/api/billing/invoices", {
      method: "POST",
      body:   JSON.stringify({ userId: "user-no-commissions" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 with invoiceId on success", async () => {
    mockAuth("admin-1", "admin");
    vi.mocked(billingService.createRetailerInvoice).mockResolvedValue({
      invoiceId:  "inv_123",
      invoiceUrl: "https://stripe.com/invoice/inv_123",
    });
    const req = new Request("http://localhost/api/billing/invoices", {
      method: "POST",
      body:   JSON.stringify({ userId: "user-1" }),
    });
    const res  = await POST(req);
    const body = await res.json() as { invoiceId: string };
    expect(res.status).toBe(201);
    expect(body.invoiceId).toBe("inv_123");
  });
});

describe("GET /api/billing/invoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for retailer role", async () => {
    mockAuth("user-1", "retailer");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns invoice list for admin", async () => {
    mockAuth("admin-1", "admin");
    vi.mocked(billingService.listInvoices).mockResolvedValue([]);
    const res  = await GET();
    const body = await res.json() as unknown[];
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
