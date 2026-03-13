# Phase 2 — Test Plan: Address + Carrier Data

**Sprint:** W2 — Phase 2 Address + Carrier Data
**Date:** 2026-03-13
**Covers:** DB schema, Zod validations, service layer, API routes, React components, admin pages, RBAC

---

## Overview

| Layer | Test Type | Tool |
|-------|-----------|------|
| Zod schemas | Unit | Vitest |
| Service layer | Unit (db mocked) | Vitest + vi.mock |
| API route handlers | Integration (handler called directly) | Vitest |
| React components | Component | Vitest + React Testing Library |
| DB constraints | Integration (real DB) | Vitest |
| Admin flows | E2E | Manual checklist / Playwright |

---

## 1. Unit Tests — Zod Validation Schemas

**File:** `src/lib/__tests__/carriers-validation.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  CreateCarrierSchema,
  UpdateCarrierSchema,
  CreateZoneSchema,
  CreatePricingSchema,
} from "@/lib/validations/carriers";

// ── CreateCarrierSchema ────────────────────────────────────────────────────────

describe("CreateCarrierSchema", () => {
  it("accepts valid input", () => {
    const result = CreateCarrierSchema.safeParse({
      name: "Amana",
      slug: "amana",
      logoUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts logoUrl as undefined (optional)", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Amana", slug: "amana" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateCarrierSchema.safeParse({ name: "", slug: "amana" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Amana", slug: "Amana" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Amana", slug: "amana express" });
    expect(result.success).toBe(false);
  });

  it("accepts slug with hyphens and numbers", () => {
    const result = CreateCarrierSchema.safeParse({ name: "Fret Express", slug: "fret-express-2" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid logoUrl", () => {
    const result = CreateCarrierSchema.safeParse({
      name: "Amana",
      slug: "amana",
      logoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid logoUrl", () => {
    const result = CreateCarrierSchema.safeParse({
      name: "Amana",
      slug: "amana",
      logoUrl: "https://cdn.example.com/amana.png",
    });
    expect(result.success).toBe(true);
  });
});

// ── UpdateCarrierSchema ────────────────────────────────────────────────────────

describe("UpdateCarrierSchema", () => {
  it("accepts partial input (name only)", () => {
    const result = UpdateCarrierSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no-op patch)", () => {
    const result = UpdateCarrierSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates slug format when provided", () => {
    const result = UpdateCarrierSchema.safeParse({ slug: "Invalid Slug!" });
    expect(result.success).toBe(false);
  });
});

// ── CreateZoneSchema ───────────────────────────────────────────────────────────

describe("CreateZoneSchema", () => {
  it("accepts valid zone", () => {
    const result = CreateZoneSchema.safeParse({ zoneName: "Grand Casablanca", zoneCode: "ZA" });
    expect(result.success).toBe(true);
  });

  it("rejects empty zoneName", () => {
    const result = CreateZoneSchema.safeParse({ zoneName: "", zoneCode: "ZA" });
    expect(result.success).toBe(false);
  });

  it("rejects empty zoneCode", () => {
    const result = CreateZoneSchema.safeParse({ zoneName: "Grand Casablanca", zoneCode: "" });
    expect(result.success).toBe(false);
  });

  it("rejects zoneCode exceeding 20 chars", () => {
    const result = CreateZoneSchema.safeParse({
      zoneName: "Zone",
      zoneCode: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});

// ── CreatePricingSchema ────────────────────────────────────────────────────────

describe("CreatePricingSchema", () => {
  it("accepts valid pricing row (bounded weight)", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null weightMaxG (open-ended tier)", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 1001,
      weightMaxG: null,
      priceMad: 4000,
      deliveryDaysMin: 2,
      deliveryDaysMax: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects weightMaxG <= weightMinG", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 500,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.weightMaxG).toBeDefined();
  });

  it("rejects deliveryDaysMax < deliveryDaysMin", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 3,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.deliveryDaysMax).toBeDefined();
  });

  it("rejects priceMad of 0", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 0,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative weightMinG", () => {
    const result = CreatePricingSchema.safeParse({
      weightMinG: -1,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(result.success).toBe(false);
  });
});
```

---

## 2. Unit Tests — Service Layer (Mocked DB)

**File:** `src/lib/__tests__/carriers-service.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      carriers: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      carrierZones: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import {
  listCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  softDeleteCarrier,
  getCarrierBySlug,
  createZone,
  deleteZone,
  createPricing,
  deletePricing,
} from "@/lib/services/carriers";

const mockCarrier = {
  id: "uuid-1",
  name: "Amana",
  slug: "amana",
  logoUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockZone = {
  id: "zone-uuid-1",
  carrierId: "uuid-1",
  zoneName: "Grand Casablanca",
  zoneCode: "ZA",
  createdAt: new Date(),
};

const mockPricing = {
  id: "pricing-uuid-1",
  zoneId: "zone-uuid-1",
  weightMinG: 0,
  weightMaxG: 500,
  priceMad: 2500,
  deliveryDaysMin: 1,
  deliveryDaysMax: 2,
  createdAt: new Date(),
};

// Helper to mock chained Drizzle calls: db.insert(table).values(...).returning()
function mockInsertChain(returnValue: unknown) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as ReturnType<typeof db.insert>);
  return { returningMock, valuesMock };
}

function mockUpdateChain(returnValue: unknown) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  vi.mocked(db.update).mockReturnValue({ set: setMock } as ReturnType<typeof db.update>);
  return { returningMock, whereMock, setMock };
}

function mockDeleteChain(returnValue: unknown) {
  const returningMock = vi.fn().mockResolvedValue([returnValue]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  vi.mocked(db.delete).mockReturnValue({ where: whereMock } as ReturnType<typeof db.delete>);
  return { returningMock, whereMock };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCarriers", () => {
  it("returns active carriers ordered by name", async () => {
    vi.mocked(db.query.carriers.findMany).mockResolvedValue([mockCarrier]);
    const result = await listCarriers();
    expect(db.query.carriers.findMany).toHaveBeenCalledOnce();
    expect(result).toEqual([mockCarrier]);
  });
});

describe("getCarrierById", () => {
  it("returns carrier with zones and pricing", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue({
      ...mockCarrier,
      zones: [{ ...mockZone, pricing: [mockPricing] }],
    });
    const result = await getCarrierById("uuid-1");
    expect(result?.id).toBe("uuid-1");
    expect(result?.zones).toHaveLength(1);
  });

  it("returns undefined for non-existent id", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(undefined);
    const result = await getCarrierById("non-existent");
    expect(result).toBeUndefined();
  });
});

describe("createCarrier", () => {
  it("inserts and returns new carrier", async () => {
    mockInsertChain(mockCarrier);
    const result = await createCarrier({ name: "Amana", slug: "amana" });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockCarrier);
  });
});

describe("updateCarrier", () => {
  it("updates carrier and sets updatedAt", async () => {
    mockUpdateChain(mockCarrier);
    const result = await updateCarrier("uuid-1", { name: "Amana Updated" });
    expect(db.update).toHaveBeenCalledOnce();
    expect(result).toEqual(mockCarrier);
  });
});

describe("softDeleteCarrier", () => {
  it("sets isActive=false", async () => {
    mockUpdateChain({ ...mockCarrier, isActive: false });
    const result = await softDeleteCarrier("uuid-1");
    expect(result.isActive).toBe(false);
  });
});

describe("getCarrierBySlug", () => {
  it("returns carrier when slug exists", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(mockCarrier);
    const result = await getCarrierBySlug("amana");
    expect(result).toEqual(mockCarrier);
  });

  it("returns undefined when slug not found", async () => {
    vi.mocked(db.query.carriers.findFirst).mockResolvedValue(undefined);
    const result = await getCarrierBySlug("unknown");
    expect(result).toBeUndefined();
  });
});

describe("createZone", () => {
  it("inserts zone with carrierId", async () => {
    mockInsertChain(mockZone);
    const result = await createZone("uuid-1", {
      zoneName: "Grand Casablanca",
      zoneCode: "ZA",
    });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockZone);
  });
});

describe("deleteZone", () => {
  it("deletes zone by id", async () => {
    mockDeleteChain(mockZone);
    const result = await deleteZone("zone-uuid-1");
    expect(db.delete).toHaveBeenCalledOnce();
    expect(result).toEqual(mockZone);
  });
});

describe("createPricing", () => {
  it("inserts pricing row with zoneId", async () => {
    mockInsertChain(mockPricing);
    const result = await createPricing("zone-uuid-1", {
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(mockPricing);
  });
});

describe("deletePricing", () => {
  it("deletes pricing row by id", async () => {
    mockDeleteChain(mockPricing);
    const result = await deletePricing("pricing-uuid-1");
    expect(db.delete).toHaveBeenCalledOnce();
    expect(result).toEqual(mockPricing);
  });
});
```

---

## 3. API Route Tests

**File:** `src/lib/__tests__/carriers-api.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

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
import { GET as carriersGET, POST as cariersPOST } from "@/app/api/carriers/route";
import {
  GET as carrierByIdGET,
  PUT as carrierByIdPUT,
  DELETE as carrierByIdDELETE,
} from "@/app/api/carriers/[id]/route";

const mockAdminAuth = () =>
  vi.mocked(auth).mockResolvedValue({
    sessionClaims: { metadata: { role: "admin" } },
  } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);

const mockRetailerAuth = () =>
  vi.mocked(auth).mockResolvedValue({
    sessionClaims: { metadata: { role: "retailer" } },
  } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);

const mockCarrier = {
  id: "uuid-1",
  name: "Amana",
  slug: "amana",
  logoUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
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
    vi.mocked(service.listCarriers).mockResolvedValue([mockCarrier]);
    const res = await carriersGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([mockCarrier]);
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
    vi.mocked(service.createCarrier).mockResolvedValue(mockCarrier);

    const req = makeRequest({ name: "Amana", slug: "amana" });
    const res = await cariersPOST(req);
    expect(res.status).toBe(201);
  });

  it("returns 403 for non-admin", async () => {
    mockRetailerAuth();
    const req = makeRequest({ name: "Amana", slug: "amana" });
    const res = await cariersPOST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body (empty slug)", async () => {
    mockAdminAuth();
    const req = makeRequest({ name: "Amana", slug: "" });
    const res = await cariersPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when slug already exists", async () => {
    mockAdminAuth();
    vi.mocked(service.getCarrierBySlug).mockResolvedValue(mockCarrier);
    const req = makeRequest({ name: "Amana 2", slug: "amana" });
    const res = await cariersPOST(req);
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
    } as Awaited<ReturnType<typeof service.getCarrierById>>);
    const res = await carrierByIdGET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
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
    } as Awaited<ReturnType<typeof service.getCarrierById>>);
    vi.mocked(service.getCarrierBySlug).mockResolvedValue(undefined);
    vi.mocked(service.updateCarrier).mockResolvedValue(mockCarrier);

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
    } as Awaited<ReturnType<typeof service.getCarrierById>>);
    vi.mocked(service.getCarrierBySlug).mockResolvedValue({ ...mockCarrier, id: "uuid-2" });

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
    } as Awaited<ReturnType<typeof service.getCarrierById>>);
    vi.mocked(service.softDeleteCarrier).mockResolvedValue({ ...mockCarrier, isActive: false });

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
```

---

## 4. Component Tests

**File:** `src/components/__tests__/carrier-table.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CarrierTable } from "@/components/carriers/carrier-table";

// Mock hooks
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-carriers", () => ({
  useDeleteCarrier: () => ({ mutate: vi.fn(), isPending: false }),
}));
// Mock QueryClientProvider context
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});

const mockCarriers = [
  {
    id: "uuid-1",
    name: "Amana",
    slug: "amana",
    logoUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("CarrierTable", () => {
  it("renders carrier name and slug", () => {
    render(<CarrierTable carriers={mockCarriers} />);
    expect(screen.getByText("Amana")).toBeInTheDocument();
    expect(screen.getByText("amana")).toBeInTheDocument();
  });

  it("shows Active badge for active carriers", () => {
    render(<CarrierTable carriers={mockCarriers} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows empty state when no carriers", () => {
    render(<CarrierTable carriers={[]} />);
    expect(screen.getByText(/No carriers yet/)).toBeInTheDocument();
  });

  it("shows Inactive badge for inactive carrier", () => {
    const inactive = [{ ...mockCarriers[0], isActive: false }];
    render(<CarrierTable carriers={inactive} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});
```

**File:** `src/components/__tests__/carrier-form.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CarrierForm } from "@/components/carriers/carrier-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }));

const mockCreate = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/hooks/use-carriers", () => ({
  useCreateCarrier: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateCarrier: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

describe("CarrierForm — create mode", () => {
  it("renders empty fields", () => {
    render(<CarrierForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Slug")).toBeInTheDocument();
  });

  it("shows validation error for empty name on submit", async () => {
    render(<CarrierForm />);
    fireEvent.click(screen.getByText("Create Carrier"));
    await waitFor(() => {
      expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
    });
  });

  it("calls createCarrier on valid submission", async () => {
    render(<CarrierForm />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Amana" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "amana" } });
    fireEvent.click(screen.getByText("Create Carrier"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: "Amana", slug: "amana" }));
  });
});

describe("CarrierForm — edit mode", () => {
  const carrier = {
    id: "uuid-1",
    name: "Amana",
    slug: "amana",
    logoUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("shows Update button in edit mode", () => {
    render(<CarrierForm carrier={carrier} />);
    expect(screen.getByText("Update Carrier")).toBeInTheDocument();
  });

  it("pre-fills form with carrier data", () => {
    render(<CarrierForm carrier={carrier} />);
    expect(screen.getByDisplayValue("Amana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("amana")).toBeInTheDocument();
  });
});
```

**File:** `src/components/__tests__/address-autocomplete.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";

// Simulate no API key → plain-text fallback
vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");

describe("AddressAutocomplete — fallback mode (no API key)", () => {
  it("renders a plain input when no API key is set", () => {
    render(<AddressAutocomplete onChange={vi.fn()} placeholder="Enter address" />);
    expect(screen.getByPlaceholderText("Enter address")).toBeInTheDocument();
  });

  it("calls onChange with address text on input", () => {
    const onChange = vi.fn();
    render(<AddressAutocomplete onChange={onChange} />);
    const input = screen.getByPlaceholderText("Enter address...");
    fireEvent.change(input, { target: { value: "Casablanca" } });
    expect(onChange).toHaveBeenCalledWith({ address: "Casablanca", lat: 0, lng: 0 });
  });
});
```

> **Note:** Full Google Places integration is tested in E2E (requires a real API key). Unit tests cover only the fallback path.

---

## 5. Database / Schema Constraint Tests

**File:** `src/lib/__tests__/carriers-db-constraints.test.ts`

> **Requires:** A live test database. Set `DATABASE_URL` to a test Postgres instance before running.
> Run only with: `pnpm test:run --include src/lib/__tests__/carriers-db-constraints.test.ts`

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { carriers, carrierZones, carrierPricing } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Cleanup helper
async function cleanUp(slug: string) {
  const c = await db.query.carriers.findFirst({ where: eq(carriers.slug, slug) });
  if (c) await db.delete(carriers).where(eq(carriers.id, c.id));
}

afterAll(async () => {
  await cleanUp("test-cascade");
  await cleanUp("test-restrict");
});

describe("Carrier cascade delete", () => {
  it("deleting a carrier cascades to its zones", async () => {
    const [carrier] = await db
      .insert(carriers)
      .values({ name: "Test Cascade", slug: "test-cascade" })
      .returning();

    await db.insert(carrierZones).values({
      carrierId: carrier.id,
      zoneName: "Zone A",
      zoneCode: "ZA",
    });

    await db.delete(carriers).where(eq(carriers.id, carrier.id));

    const zones = await db.query.carrierZones.findMany({
      where: eq(carrierZones.carrierId, carrier.id),
    });

    expect(zones).toHaveLength(0);
  });
});

describe("Zone FK restrict on delete", () => {
  it("throws FK violation when deleting zone with existing pricing rows", async () => {
    const [carrier] = await db
      .insert(carriers)
      .values({ name: "Test Restrict", slug: "test-restrict" })
      .returning();

    const [zone] = await db
      .insert(carrierZones)
      .values({ carrierId: carrier.id, zoneName: "Zone B", zoneCode: "ZB" })
      .returning();

    await db.insert(carrierPricing).values({
      zoneId: zone.id,
      weightMinG: 0,
      weightMaxG: 500,
      priceMad: 2500,
      deliveryDaysMin: 1,
      deliveryDaysMax: 2,
    });

    // Attempting to delete zone with pricing → FK restrict should throw
    await expect(
      db.delete(carrierZones).where(eq(carrierZones.id, zone.id))
    ).rejects.toThrow();

    // Cleanup
    await db.delete(carrierPricing).where(eq(carrierPricing.zoneId, zone.id));
    await db.delete(carrierZones).where(eq(carrierZones.id, zone.id));
    await db.delete(carriers).where(eq(carriers.id, carrier.id));
  });
});

describe("Seed data", () => {
  it("5 carriers are seeded and active", async () => {
    const seeded = await db.query.carriers.findMany({
      where: eq(carriers.isActive, true),
    });
    // After running pnpm db:seed, at least 5 active carriers must exist
    expect(seeded.length).toBeGreaterThanOrEqual(5);

    const slugs = seeded.map((c) => c.slug);
    expect(slugs).toContain("amana");
    expect(slugs).toContain("chronopost");
    expect(slugs).toContain("ctm");
    expect(slugs).toContain("fret-express");
    expect(slugs).toContain("colis-prive");
  });

  it("priceMad is stored in centimes (integer)", async () => {
    const carrier = await db.query.carriers.findFirst({
      where: eq(carriers.slug, "amana"),
      with: { zones: { with: { pricing: true } } },
    });
    expect(carrier).toBeDefined();
    const allPrices = carrier!.zones.flatMap((z) => z.pricing.map((p) => p.priceMad));
    // All prices should be integers >= 100 (1 MAD minimum in centimes)
    allPrices.forEach((price) => {
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(100);
    });
  });
});
```

---

## 6. E2E / Smoke Tests — Manual Checklist

Run these after `pnpm db:seed` and `pnpm dev`.

### 6.1 Seed Verification

- [ ] Run `pnpm db:seed` → output shows 5 carriers created (or "already exists" if re-run)
- [ ] Run `pnpm db:studio` → open `carriers` table → verify 5 rows: amana, chronopost, ctm, fret-express, colis-prive
- [ ] In `carrier_zones` table → verify each carrier has at least 1 zone
- [ ] In `carrier_pricing` table → verify pricing rows exist with `price_mad` as integers

### 6.2 Public API

- [ ] `GET http://localhost:3000/api/carriers` → returns JSON array of active carriers, no auth required
- [ ] `GET http://localhost:3000/api/carriers/<id>` (use a real id from above) → returns carrier with nested zones + pricing
- [ ] `GET http://localhost:3000/api/carriers/non-existent-id` → returns `{ error: "Carrier not found" }` with status 404

### 6.3 Admin CRUD — Happy Path

1. Sign in at `http://localhost:3000/sign-in` as a user with `role = "admin"` (set via Clerk dashboard `publicMetadata`)
2. Navigate to `http://localhost:3000/dashboard`
3. - [ ] "Carriers" nav link is visible in the header
4. Click "Carriers" → redirects to `/admin/carriers`
5. - [ ] Seeded carriers appear in the table with Active badges
6. Click "+ Add Carrier"
7. - [ ] Form appears at `/admin/carriers/new`
8. Fill: Name = "Test Carrier", Slug = "test-carrier" → Submit
9. - [ ] Redirects to `/admin/carriers` → "Test Carrier" appears in list
10. Click "Edit" on "Test Carrier"
11. - [ ] Edit page loads at `/admin/carriers/<id>` with form pre-filled
12. - [ ] Zones & Pricing section shows (empty accordion)
13. Click "+ Add Zone" → fill Zone Name = "National", Zone Code = "NAT" → Add
14. - [ ] Zone appears in accordion
15. Expand zone → click "+ Add Pricing Row" → fill min=0, max=500, price=2500, min days=1, max days=2 → Add Row
16. - [ ] Pricing row appears: "0g – 500g · 25.00 MAD · 1–2 days"
17. Try to delete zone (button should be disabled — pricing exists)
18. - [ ] "Delete Zone" button is disabled
19. Click "Remove" on pricing row → pricing disappears
20. Now click "Delete Zone" → zone disappears from accordion
21. Back on carrier list → click "Delete" on "Test Carrier"
22. - [ ] Carrier disappears from list (soft-deleted, `is_active = false`)

### 6.4 RBAC — Retailer is Blocked

1. Sign in as a user with `role = "retailer"`
2. Navigate to `/dashboard`
3. - [ ] "Carriers" nav link is **not** visible in header
4. Manually navigate to `http://localhost:3000/admin/carriers`
5. - [ ] Clerk middleware redirects to sign-in (or shows 404/403)
6. Run in browser console or via curl:
   ```bash
   curl -X POST http://localhost:3000/api/carriers \
     -H "Content-Type: application/json" \
     -d '{"name":"Hack","slug":"hack"}' \
     --cookie "<retailer_session_cookie>"
   ```
7. - [ ] Response: `{ "error": "Forbidden" }` with status 403

### 6.5 Validation Errors — UI

1. Navigate to `/admin/carriers/new` as admin
2. Submit empty form → verify field errors appear: "Name is required", "Slug is required"
3. Enter slug = "Invalid Slug!" → verify "Slug must be lowercase letters, numbers, and hyphens only"
4. Submit form with a slug that already exists (e.g., "amana") → verify toast/error shows slug conflict

### 6.6 AddressAutocomplete — Fallback

1. Open any page that uses `<AddressAutocomplete>` (or test in isolation via `pnpm dev`)
2. Remove or leave blank `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`
3. - [ ] Component renders a plain text input (no Google Maps suggestion dropdown)
4. Type in the input → `onChange` fires with `{ address: "...", lat: 0, lng: 0 }`

### 6.7 AddressAutocomplete — Google Places (requires API key)

1. Set valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`
2. Render the component
3. - [ ] Google Maps script loads (visible in Network tab)
4. Type "Casa" → - [ ] dropdown suggestions appear (Morocco addresses only)
5. Select a suggestion → - [ ] `onChange` fires with correct `{ address, lat, lng }` values
6. - [ ] Results restricted to Morocco (no international suggestions)

---

## 7. Running Tests

```bash
# Unit + component tests (no DB required)
pnpm test:run

# DB constraint tests (requires DATABASE_URL to a test DB)
pnpm test:run --include src/lib/__tests__/carriers-db-constraints.test.ts

# Full watch mode during development
pnpm test

# Type check before committing
pnpm typecheck

# Lint before committing
pnpm lint
```

---

## 8. Acceptance Criteria

All of the following must pass before Phase 2 is considered done:

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | 5 Moroccan carriers seeded with zones + pricing | `pnpm db:seed` + Drizzle Studio |
| 2 | `GET /api/carriers` returns data without auth | curl / browser |
| 3 | `POST /api/carriers` returns 403 for non-admin | curl with retailer session |
| 4 | Admin can create / edit / delete carriers via UI | Manual E2E 6.3 |
| 5 | Deleting a zone with pricing shows 409 | Manual E2E 6.3 step 17–18 |
| 6 | Carrier delete is a soft-delete (`isActive=false`) | Manual E2E 6.3 step 22 + DB check |
| 7 | Carriers nav link hidden for non-admins | Manual E2E 6.4 |
| 8 | AddressAutocomplete fallback works without API key | Manual E2E 6.6 |
| 9 | All Vitest unit tests pass (8+ Phase 1 + new Phase 2 tests) | `pnpm test:run` |
| 10 | `pnpm typecheck` passes with 0 errors | CI + local |
| 11 | `pnpm build` succeeds | CI + local |
