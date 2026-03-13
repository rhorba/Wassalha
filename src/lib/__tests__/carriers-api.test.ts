import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock service layer
vi.mock("@/lib/services/carriers", () => ({
  listCarriers: vi.fn(),
  createCarrier: vi.fn(),
  getCarrierBySlug: vi.fn(),
  getCarrierById: vi.fn(),
  updateCarrier: vi.fn(),
  softDeleteCarrier: vi.fn(),
  createZone: vi.fn(),
  getZone: vi.fn(),
  deleteZone: vi.fn(),
  createPricing: vi.fn(),
  deletePricing: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import * as service from "@/lib/services/carriers";
import { GET as carriersGET, POST as carriersPOST } from "@/app/api/carriers/route";
import {
  GET as carrierByIdGET,
  PUT as carrierByIdPUT,
  DELETE as carrierByIdDELETE,
} from "@/app/api/carriers/[id]/route";

type AuthResult = Awaited<ReturnType<typeof auth>>;

const mockAdminAuth = () =>
  vi.mocked(auth).mockResolvedValue({
    sessionClaims: { metadata: { role: "admin" } },
  } as unknown as AuthResult);

const mockRetailerAuth = () =>
  vi.mocked(auth).mockResolvedValue({
    sessionClaims: { metadata: { role: "retailer" } },
  } as unknown as AuthResult);

const mockCarrier = {
  id: "uuid-1",
  name: "Amana",
  slug: "amana",
  logoUrl: null,
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/carriers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/carriers ──────────────────────────────────────────────────────────

describe("GET /api/carriers", () => {
  it("returns 200 with carriers list (public)", async () => {
    vi.mocked(service.listCarriers).mockResolvedValue(
      [mockCarrier] as unknown as Awaited<ReturnType<typeof service.listCarriers>>
    );
    const res = await carriersGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("uuid-1");
    expect(body[0].name).toBe("Amana");
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(service.listCarriers).mockRejectedValue(new Error("DB error"));
    const res = await carriersGET();
    expect(res.status).toBe(500);
  });
});

// ── POST /api/carriers ─────────────────────────────────────────────────────────

describe("POST /api/carriers", () => {
  it("returns 201 with created carrier (admin)", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierBySlug).mockResolvedValue(undefined);
    vi.mocked(service.createCarrier).mockResolvedValue(
      mockCarrier as unknown as Awaited<ReturnType<typeof service.createCarrier>>
    );

    const req = makeRequest({ name: "Amana", slug: "amana" });
    const res = await carriersPOST(req);
    expect(res.status).toBe(201);
  });

  it("returns 403 for non-admin", async () => {
    mockRetailerAuth();
    const req = makeRequest({ name: "Amana", slug: "amana" });
    const res = await carriersPOST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body (empty slug)", async () => {
    mockAdminAuth();
    const req = makeRequest({ name: "Amana", slug: "" });
    const res = await carriersPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when slug already exists", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierBySlug).mockResolvedValue(
      mockCarrier as unknown as Awaited<ReturnType<typeof service.getCarrierBySlug>>
    );
    const req = makeRequest({ name: "Amana 2", slug: "amana" });
    const res = await carriersPOST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SLUG_CONFLICT");
  });
});

// ── GET /api/carriers/[id] ─────────────────────────────────────────────────────

describe("GET /api/carriers/[id]", () => {
  const params = Promise.resolve({ id: "uuid-1" });

  it("returns 200 with carrier (public)", async () => {
    vi.mocked(service.getCarrierById).mockResolvedValue({
      ...mockCarrier,
      zones: [],
    } as unknown as Awaited<ReturnType<typeof service.getCarrierById>>);
    const res = await carrierByIdGET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("uuid-1");
  });

  it("returns 404 when carrier not found", async () => {
    vi.mocked(service.getCarrierById).mockResolvedValue(undefined);
    const res = await carrierByIdGET(new Request("http://localhost"), { params });
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/carriers/[id] ─────────────────────────────────────────────────────

describe("PUT /api/carriers/[id]", () => {
  const params = Promise.resolve({ id: "uuid-1" });

  it("returns 200 with updated carrier (admin)", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierById).mockResolvedValue({
      ...mockCarrier,
      zones: [],
    } as unknown as Awaited<ReturnType<typeof service.getCarrierById>>);
    vi.mocked(service.getCarrierBySlug).mockResolvedValue(undefined);
    vi.mocked(service.updateCarrier).mockResolvedValue(
      mockCarrier as unknown as Awaited<ReturnType<typeof service.updateCarrier>>
    );

    const req = makeRequest({ name: "Amana Updated" });
    const res = await carrierByIdPUT(req, { params });
    expect(res.status).toBe(200);
  });

  it("returns 403 for non-admin", async () => {
    mockRetailerAuth();
    const req = makeRequest({ name: "X" });
    const res = await carrierByIdPUT(req, { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when carrier not found", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierById).mockResolvedValue(undefined);
    const req = makeRequest({ name: "X" });
    const res = await carrierByIdPUT(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns 409 on slug conflict with another carrier", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierById).mockResolvedValue({
      ...mockCarrier,
      zones: [],
    } as unknown as Awaited<ReturnType<typeof service.getCarrierById>>);
    vi.mocked(service.getCarrierBySlug).mockResolvedValue(
      { ...mockCarrier, id: "uuid-2" } as unknown as Awaited<ReturnType<typeof service.getCarrierBySlug>>
    );

    const req = makeRequest({ slug: "chronopost" });
    const res = await carrierByIdPUT(req, { params });
    expect(res.status).toBe(409);
  });
});

// ── DELETE /api/carriers/[id] ──────────────────────────────────────────────────

describe("DELETE /api/carriers/[id]", () => {
  const params = Promise.resolve({ id: "uuid-1" });

  it("soft-deletes carrier (admin)", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierById).mockResolvedValue({
      ...mockCarrier,
      zones: [],
    } as unknown as Awaited<ReturnType<typeof service.getCarrierById>>);
    vi.mocked(service.softDeleteCarrier).mockResolvedValue(
      { ...mockCarrier, isActive: false } as unknown as Awaited<ReturnType<typeof service.softDeleteCarrier>>
    );

    const res = await carrierByIdDELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isActive).toBe(false);
  });

  it("returns 403 for non-admin", async () => {
    mockRetailerAuth();
    const res = await carrierByIdDELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when carrier not found", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierById).mockResolvedValue(undefined);
    const res = await carrierByIdDELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(404);
  });
});
