# Phase 2 — Address Autocomplete + Carrier Database + Admin CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Add 3 Drizzle tables (carriers, carrier_zones, carrier_pricing), a seed script with 5 Moroccan carriers, a full admin CRUD UI, and a reusable Google Places address autocomplete component.

**Architecture:** Drizzle schema → Zod validation → service layer → Next.js API routes → TanStack Query hooks → shadcn/ui React components. Admin writes are Clerk-gated (`role === "admin"`) inside route handlers. GET endpoints are public for Phase 3 consumption. AddressAutocomplete is a standalone Client Component with a plain-text fallback.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W2 — Phase 2 Address + Carrier Data

---

## Tasks Overview

| # | Task | Files |
|---|------|-------|
| 1 | Install new dependencies | `package.json` |
| 2 | Define Drizzle schema — carriers, carrier_zones, carrier_pricing | `src/lib/db/schema/carriers.ts` |
| 3 | Generate + apply migration | `src/lib/db/migrations/` |
| 4 | Create Zod validation schemas | `src/lib/validations/carriers.ts` |
| 5 | Create carrier service layer | `src/lib/services/carriers.ts` |
| 6 | Create API route — carrier list + create | `src/app/api/carriers/route.ts` |
| 7 | Create API route — carrier get + update + delete | `src/app/api/carriers/[id]/route.ts` |
| 8 | Create API routes — zones | `src/app/api/carriers/[id]/zones/route.ts`, `[zoneId]/route.ts` |
| 9 | Create API routes — pricing | `src/app/api/carriers/[id]/zones/[zoneId]/pricing/route.ts`, `[pricingId]/route.ts` |
| 10 | Create seed script | `src/lib/db/seed.ts` |
| 11 | Add `pnpm db:seed` script + install shadcn components | `package.json`, shadcn CLI |
| 12 | Create TanStack Query provider + hooks | `src/app/providers.tsx`, `src/hooks/use-carriers.ts` |
| 13 | Create `CarrierTable` component | `src/components/carriers/carrier-table.tsx` |
| 14 | Create `CarrierForm` component | `src/components/carriers/carrier-form.tsx` |
| 15 | Create `ZoneAccordion` + `PricingRow` components | `src/components/carriers/zone-accordion.tsx` |
| 16 | Create admin carrier list page (RSC) | `src/app/(dashboard)/admin/carriers/page.tsx` |
| 17 | Create admin carrier new page | `src/app/(dashboard)/admin/carriers/new/page.tsx` |
| 18 | Create admin carrier edit page | `src/app/(dashboard)/admin/carriers/[id]/page.tsx` |
| 19 | Create `AddressAutocomplete` component | `src/components/forms/address-autocomplete.tsx` |
| 20 | Update dashboard layout — admin nav link | `src/app/(dashboard)/layout.tsx` |
| 21 | Final verification | typecheck + lint + test + build |

---

## Task 1: Install New Dependencies

**Files:**
- Modify: `package.json` (via pnpm)

**Step 1: Install production dependencies**
```bash
pnpm add @googlemaps/js-api-loader
```

> `@tanstack/react-query` and `react-hook-form` were already installed in Phase 1. Confirm with:
```bash
pnpm list @tanstack/react-query react-hook-form @hookform/resolvers
```
If any are missing, install them:
```bash
pnpm add @tanstack/react-query react-hook-form @hookform/resolvers
```

**Step 2: Install dev dependencies**
```bash
pnpm add -D @types/google.maps
```

**Step 3: Verify**
```bash
pnpm typecheck
```
Expected: 0 errors.

---

## Task 2: Define Drizzle Schema — carriers, carrier_zones, carrier_pricing

**Files:**
- Create: `src/lib/db/schema/carriers.ts`
- Modify: `src/lib/db/schema/index.ts`

**Step 1: Create `src/lib/db/schema/carriers.ts`**
```ts
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const carriers = pgTable("carriers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const carrierZones = pgTable("carrier_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierId: uuid("carrier_id")
    .notNull()
    .references(() => carriers.id, { onDelete: "cascade" }),
  zoneName: text("zone_name").notNull(),
  zoneCode: text("zone_code").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const carrierPricing = pgTable("carrier_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => carrierZones.id, { onDelete: "restrict" }),
  weightMinG: integer("weight_min_g").notNull(),
  weightMaxG: integer("weight_max_g"), // null = no upper limit
  priceMad: integer("price_mad").notNull(), // centimes — 1500 = 15.00 MAD
  deliveryDaysMin: integer("delivery_days_min").notNull(),
  deliveryDaysMax: integer("delivery_days_max").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Carrier = typeof carriers.$inferSelect;
export type NewCarrier = typeof carriers.$inferInsert;
export type CarrierZone = typeof carrierZones.$inferSelect;
export type NewCarrierZone = typeof carrierZones.$inferInsert;
export type CarrierPricing = typeof carrierPricing.$inferSelect;
export type NewCarrierPricing = typeof carrierPricing.$inferInsert;
```

> **Important:** `carrierPricing.zoneId` uses `onDelete: "restrict"` — this enforces the "delete pricing before zone" rule at the DB level. `carrierZones.carrierId` uses `onDelete: "cascade"` — deleting a carrier auto-deletes its zones.

**Step 2: Update `src/lib/db/schema/index.ts`**
```ts
export * from "./users";
export * from "./carriers";
```

---

## Task 3: Generate + Apply Drizzle Migration

**Files:**
- Auto-generated: `src/lib/db/migrations/000X_<name>.sql`

**Step 1: Generate migration**
```bash
pnpm db:generate
```
Expected output: a new `.sql` file in `src/lib/db/migrations/` with `CREATE TABLE carriers`, `CREATE TABLE carrier_zones`, `CREATE TABLE carrier_pricing`.

**Step 2: Apply migration**
```bash
pnpm db:migrate
```
Expected: Migration applied successfully. Tables visible in Drizzle Studio (`pnpm db:studio`).

**Step 3: Verify schema**
```bash
pnpm typecheck
```
Expected: 0 errors.

---

## Task 4: Create Zod Validation Schemas

**Files:**
- Create: `src/lib/validations/carriers.ts`

**Step 1: Create `src/lib/validations/carriers.ts`**
```ts
import { z } from "zod";

export const CreateCarrierSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  logoUrl: z.string().url("Must be a valid URL").nullable().optional(),
});

export const UpdateCarrierSchema = CreateCarrierSchema.partial();

export const CreateZoneSchema = z.object({
  zoneName: z.string().min(1, "Zone name is required").max(100),
  zoneCode: z.string().min(1, "Zone code is required").max(20),
});

export const CreatePricingSchema = z.object({
  weightMinG: z.number().int().min(0, "Min weight must be >= 0"),
  weightMaxG: z.number().int().min(1).nullable().optional(),
  priceMad: z.number().int().min(1, "Price must be >= 1 centime"),
  deliveryDaysMin: z.number().int().min(1),
  deliveryDaysMax: z.number().int().min(1),
}).refine(
  (data) =>
    data.weightMaxG === null ||
    data.weightMaxG === undefined ||
    data.weightMaxG > data.weightMinG,
  { message: "Max weight must be greater than min weight", path: ["weightMaxG"] }
).refine(
  (data) => data.deliveryDaysMax >= data.deliveryDaysMin,
  { message: "Max delivery days must be >= min", path: ["deliveryDaysMax"] }
);

export type CreateCarrierInput = z.infer<typeof CreateCarrierSchema>;
export type UpdateCarrierInput = z.infer<typeof UpdateCarrierSchema>;
export type CreateZoneInput = z.infer<typeof CreateZoneSchema>;
export type CreatePricingInput = z.infer<typeof CreatePricingSchema>;
```

---

## Task 5: Create Carrier Service Layer

**Files:**
- Create: `src/lib/services/carriers.ts`

**Step 1: Create `src/lib/services/carriers.ts`**
```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { carriers, carrierZones, carrierPricing } from "@/lib/db/schema";
import type {
  CreateCarrierInput,
  UpdateCarrierInput,
  CreateZoneInput,
  CreatePricingInput,
} from "@/lib/validations/carriers";

// ── Carriers ──────────────────────────────────────────────────────────────────

export async function listCarriers() {
  return db.query.carriers.findMany({
    where: eq(carriers.isActive, true),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}

export async function getCarrierById(id: string) {
  return db.query.carriers.findFirst({
    where: eq(carriers.id, id),
    with: {
      zones: {
        with: { pricing: true },
      },
    },
  });
}

export async function createCarrier(input: CreateCarrierInput) {
  const [carrier] = await db.insert(carriers).values(input).returning();
  return carrier;
}

export async function updateCarrier(id: string, input: UpdateCarrierInput) {
  const [carrier] = await db
    .update(carriers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(carriers.id, id))
    .returning();
  return carrier;
}

export async function softDeleteCarrier(id: string) {
  const [carrier] = await db
    .update(carriers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(carriers.id, id))
    .returning();
  return carrier;
}

export async function getCarrierBySlug(slug: string) {
  return db.query.carriers.findFirst({ where: eq(carriers.slug, slug) });
}

// ── Zones ─────────────────────────────────────────────────────────────────────

export async function createZone(carrierId: string, input: CreateZoneInput) {
  const [zone] = await db
    .insert(carrierZones)
    .values({ ...input, carrierId })
    .returning();
  return zone;
}

export async function deleteZone(zoneId: string) {
  // DB will throw FK violation if pricing rows exist (onDelete: restrict)
  const [zone] = await db
    .delete(carrierZones)
    .where(eq(carrierZones.id, zoneId))
    .returning();
  return zone;
}

export async function getZone(zoneId: string) {
  return db.query.carrierZones.findFirst({
    where: eq(carrierZones.id, zoneId),
  });
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export async function createPricing(zoneId: string, input: CreatePricingInput) {
  const [pricing] = await db
    .insert(carrierPricing)
    .values({ ...input, zoneId })
    .returning();
  return pricing;
}

export async function deletePricing(pricingId: string) {
  const [pricing] = await db
    .delete(carrierPricing)
    .where(eq(carrierPricing.id, pricingId))
    .returning();
  return pricing;
}
```

**Step 2: Add Drizzle relations** (needed for `db.query` with `with:`)

Update `src/lib/db/schema/carriers.ts` — append at the bottom:
```ts
import { relations } from "drizzle-orm";

export const carriersRelations = relations(carriers, ({ many }) => ({
  zones: many(carrierZones),
}));

export const carrierZonesRelations = relations(carrierZones, ({ one, many }) => ({
  carrier: one(carriers, { fields: [carrierZones.carrierId], references: [carriers.id] }),
  pricing: many(carrierPricing),
}));

export const carrierPricingRelations = relations(carrierPricing, ({ one }) => ({
  zone: one(carrierZones, { fields: [carrierPricing.zoneId], references: [carrierZones.id] }),
}));
```

**Step 3: Verify**
```bash
pnpm typecheck
```
Expected: 0 errors.

---

## Task 6: API Route — Carrier List + Create

**Files:**
- Create: `src/app/api/carriers/route.ts`

**Step 1: Create `src/app/api/carriers/route.ts`**
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CreateCarrierSchema } from "@/lib/validations/carriers";
import {
  listCarriers,
  createCarrier,
  getCarrierBySlug,
} from "@/lib/services/carriers";

export async function GET() {
  try {
    const data = await listCarriers();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch carriers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = CreateCarrierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await getCarrierBySlug(parsed.data.slug);
  if (existing) {
    return NextResponse.json({ error: "Slug already exists", code: "SLUG_CONFLICT" }, { status: 409 });
  }

  const carrier = await createCarrier(parsed.data);
  return NextResponse.json(carrier, { status: 201 });
}
```

---

## Task 7: API Route — Carrier Get + Update + Delete

**Files:**
- Create: `src/app/api/carriers/[id]/route.ts`

**Step 1: Create `src/app/api/carriers/[id]/route.ts`**
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UpdateCarrierSchema } from "@/lib/validations/carriers";
import {
  getCarrierById,
  updateCarrier,
  softDeleteCarrier,
  getCarrierBySlug,
} from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const carrier = await getCarrierById(id);
  if (!carrier) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }
  return NextResponse.json(carrier);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = UpdateCarrierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await getCarrierById(id);
  if (!existing) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }

  // Slug uniqueness check (if slug is being changed)
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugOwner = await getCarrierBySlug(parsed.data.slug);
    if (slugOwner) {
      return NextResponse.json({ error: "Slug already exists", code: "SLUG_CONFLICT" }, { status: 409 });
    }
  }

  const updated = await updateCarrier(id, parsed.data);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getCarrierById(id);
  if (!existing) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }

  const carrier = await softDeleteCarrier(id);
  return NextResponse.json(carrier);
}
```

---

## Task 8: API Routes — Zones

**Files:**
- Create: `src/app/api/carriers/[id]/zones/route.ts`
- Create: `src/app/api/carriers/[id]/zones/[zoneId]/route.ts`

**Step 1: Create `src/app/api/carriers/[id]/zones/route.ts`**
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CreateZoneSchema } from "@/lib/validations/carriers";
import { getCarrierById, createZone } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const carrier = await getCarrierById(id);
  if (!carrier) {
    return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = CreateZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const zone = await createZone(id, parsed.data);
  return NextResponse.json(zone, { status: 201 });
}
```

**Step 2: Create `src/app/api/carriers/[id]/zones/[zoneId]/route.ts`**
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getZone, deleteZone } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string; zoneId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { zoneId } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const zone = await getZone(zoneId);
  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  try {
    const deleted = await deleteZone(zoneId);
    return NextResponse.json(deleted);
  } catch {
    // FK restrict violation — pricing rows exist
    return NextResponse.json(
      { error: "Delete all pricing rows for this zone first", code: "ZONE_HAS_PRICING" },
      { status: 409 }
    );
  }
}
```

---

## Task 9: API Routes — Pricing

**Files:**
- Create: `src/app/api/carriers/[id]/zones/[zoneId]/pricing/route.ts`
- Create: `src/app/api/carriers/[id]/zones/[zoneId]/pricing/[pricingId]/route.ts`

**Step 1: Create `src/app/api/carriers/[id]/zones/[zoneId]/pricing/route.ts`**
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CreatePricingSchema } from "@/lib/validations/carriers";
import { getZone, createPricing } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string; zoneId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { zoneId } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const zone = await getZone(zoneId);
  if (!zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = CreatePricingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pricing = await createPricing(zoneId, parsed.data);
  return NextResponse.json(pricing, { status: 201 });
}
```

**Step 2: Create `src/app/api/carriers/[id]/zones/[zoneId]/pricing/[pricingId]/route.ts`**
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deletePricing } from "@/lib/services/carriers";

type Params = { params: Promise<{ id: string; zoneId: string; pricingId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { pricingId } = await params;
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await deletePricing(pricingId);
  if (!deleted) {
    return NextResponse.json({ error: "Pricing row not found" }, { status: 404 });
  }
  return NextResponse.json(deleted);
}
```

---

## Task 10: Create Seed Script

**Files:**
- Create: `src/lib/db/seed.ts`

**Step 1: Create `src/lib/db/seed.ts`**
```ts
import { db } from "./index";
import { carriers, carrierZones, carrierPricing } from "./schema";
import { eq } from "drizzle-orm";

const CARRIERS_SEED = [
  {
    name: "Amana",
    slug: "amana",
    logoUrl: null,
    zones: [
      {
        zoneName: "Grand Casablanca",
        zoneCode: "ZA",
        pricing: [
          { weightMinG: 0, weightMaxG: 500, priceMad: 2500, deliveryDaysMin: 1, deliveryDaysMax: 2 },
          { weightMinG: 501, weightMaxG: 1000, priceMad: 3000, deliveryDaysMin: 1, deliveryDaysMax: 2 },
          { weightMinG: 1001, weightMaxG: null, priceMad: 4000, deliveryDaysMin: 2, deliveryDaysMax: 3 },
        ],
      },
      {
        zoneName: "Villes Secondaires",
        zoneCode: "ZB",
        pricing: [
          { weightMinG: 0, weightMaxG: 500, priceMad: 3000, deliveryDaysMin: 2, deliveryDaysMax: 3 },
          { weightMinG: 501, weightMaxG: null, priceMad: 4500, deliveryDaysMin: 2, deliveryDaysMax: 4 },
        ],
      },
    ],
  },
  {
    name: "Chronopost Maroc",
    slug: "chronopost",
    logoUrl: null,
    zones: [
      {
        zoneName: "Zone Express",
        zoneCode: "EXP",
        pricing: [
          { weightMinG: 0, weightMaxG: 1000, priceMad: 4500, deliveryDaysMin: 1, deliveryDaysMax: 1 },
          { weightMinG: 1001, weightMaxG: null, priceMad: 6000, deliveryDaysMin: 1, deliveryDaysMax: 2 },
        ],
      },
      {
        zoneName: "Zone Standard",
        zoneCode: "STD",
        pricing: [
          { weightMinG: 0, weightMaxG: 1000, priceMad: 3000, deliveryDaysMin: 2, deliveryDaysMax: 3 },
          { weightMinG: 1001, weightMaxG: null, priceMad: 4000, deliveryDaysMin: 3, deliveryDaysMax: 4 },
        ],
      },
    ],
  },
  {
    name: "CTM Messageries",
    slug: "ctm",
    logoUrl: null,
    zones: [
      {
        zoneName: "Axe Principal",
        zoneCode: "AXE",
        pricing: [
          { weightMinG: 0, weightMaxG: 2000, priceMad: 2800, deliveryDaysMin: 1, deliveryDaysMax: 2 },
          { weightMinG: 2001, weightMaxG: null, priceMad: 4200, deliveryDaysMin: 2, deliveryDaysMax: 3 },
        ],
      },
      {
        zoneName: "Zones Éloignées",
        zoneCode: "ELO",
        pricing: [
          { weightMinG: 0, weightMaxG: 2000, priceMad: 3500, deliveryDaysMin: 3, deliveryDaysMax: 5 },
          { weightMinG: 2001, weightMaxG: null, priceMad: 5000, deliveryDaysMin: 4, deliveryDaysMax: 6 },
        ],
      },
    ],
  },
  {
    name: "Fret Express",
    slug: "fret-express",
    logoUrl: null,
    zones: [
      {
        zoneName: "National",
        zoneCode: "NAT",
        pricing: [
          { weightMinG: 0, weightMaxG: 500, priceMad: 2200, deliveryDaysMin: 2, deliveryDaysMax: 3 },
          { weightMinG: 501, weightMaxG: 2000, priceMad: 3200, deliveryDaysMin: 2, deliveryDaysMax: 4 },
          { weightMinG: 2001, weightMaxG: null, priceMad: 5000, deliveryDaysMin: 3, deliveryDaysMax: 5 },
        ],
      },
    ],
  },
  {
    name: "Colis Privé Maroc",
    slug: "colis-prive",
    logoUrl: null,
    zones: [
      {
        zoneName: "Zone Urbaine",
        zoneCode: "URB",
        pricing: [
          { weightMinG: 0, weightMaxG: 1000, priceMad: 2700, deliveryDaysMin: 1, deliveryDaysMax: 2 },
          { weightMinG: 1001, weightMaxG: null, priceMad: 3800, deliveryDaysMin: 2, deliveryDaysMax: 3 },
        ],
      },
      {
        zoneName: "Zone Périphérique",
        zoneCode: "PER",
        pricing: [
          { weightMinG: 0, weightMaxG: 1000, priceMad: 3200, deliveryDaysMin: 2, deliveryDaysMax: 4 },
          { weightMinG: 1001, weightMaxG: null, priceMad: 4500, deliveryDaysMin: 3, deliveryDaysMax: 5 },
        ],
      },
    ],
  },
];

async function seed() {
  console.log("Seeding carriers...");

  for (const carrierData of CARRIERS_SEED) {
    // Idempotent — skip if already exists
    const existing = await db.query.carriers.findFirst({
      where: eq(carriers.slug, carrierData.slug),
    });

    if (existing) {
      console.log(`  Skipping ${carrierData.name} (already exists)`);
      continue;
    }

    const [carrier] = await db
      .insert(carriers)
      .values({
        name: carrierData.name,
        slug: carrierData.slug,
        logoUrl: carrierData.logoUrl,
      })
      .returning();

    console.log(`  Created carrier: ${carrier.name}`);

    for (const zoneData of carrierData.zones) {
      const [zone] = await db
        .insert(carrierZones)
        .values({
          carrierId: carrier.id,
          zoneName: zoneData.zoneName,
          zoneCode: zoneData.zoneCode,
        })
        .returning();

      console.log(`    Zone: ${zone.zoneName}`);

      for (const pricingData of zoneData.pricing) {
        await db.insert(carrierPricing).values({
          zoneId: zone.id,
          ...pricingData,
        });
      }
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

> **Note:** `priceMad` is stored in centimes. 2500 = 25.00 MAD. Display logic divides by 100.

---

## Task 11: Add `pnpm db:seed` Script + Install shadcn Components

**Files:**
- Modify: `package.json`

**Step 1: Add seed script to `package.json`**

Find the `"scripts"` block and add:
```json
"db:seed": "dotenv -e .env.local -- tsx src/lib/db/seed.ts"
```

> `tsx` and `dotenv-cli` were installed in Phase 1. Confirm with `pnpm list tsx dotenv-cli`.

**Step 2: Run seed**
```bash
pnpm db:seed
```
Expected: 5 carriers created with zones and pricing rows. Check in Drizzle Studio:
```bash
pnpm db:studio
```

**Step 3: Install shadcn components needed for admin UI**
```bash
pnpm dlx shadcn@latest add accordion table badge
```

Expected: `src/components/ui/accordion.tsx`, `table.tsx`, `badge.tsx` created.

---

## Task 12: Create TanStack Query Provider + Carrier Hooks

**Files:**
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/hooks/use-carriers.ts`

**Step 1: Create `src/app/providers.tsx`**
```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Wrap root layout with `<Providers>`**

In `src/app/layout.tsx`, import and wrap `{children}`:
```tsx
import { Providers } from "./providers";
// ...inside the <body>:
<Providers>{children}</Providers>
```

**Step 3: Create `src/hooks/use-carriers.ts`**
```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCarrierInput, UpdateCarrierInput, CreateZoneInput, CreatePricingInput } from "@/lib/validations/carriers";

// ── Carrier mutations ─────────────────────────────────────────────────────────

export function useCreateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCarrierInput) => {
      const res = await fetch("/api/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carriers"] }),
  });
}

export function useUpdateCarrier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateCarrierInput) => {
      const res = await fetch(`/api/carriers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carriers"] });
      qc.invalidateQueries({ queryKey: ["carrier", id] });
    },
  });
}

export function useDeleteCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/carriers/${id}`, { method: "DELETE" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carriers"] }),
  });
}

// ── Zone mutations ────────────────────────────────────────────────────────────

export function useCreateZone(carrierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateZoneInput) => {
      const res = await fetch(`/api/carriers/${carrierId}/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}

export function useDeleteZone(carrierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await fetch(`/api/carriers/${carrierId}/zones/${zoneId}`, { method: "DELETE" });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}

// ── Pricing mutations ─────────────────────────────────────────────────────────

export function useCreatePricing(carrierId: string, zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePricingInput) => {
      const res = await fetch(`/api/carriers/${carrierId}/zones/${zoneId}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}

export function useDeletePricing(carrierId: string, zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pricingId: string) => {
      const res = await fetch(
        `/api/carriers/${carrierId}/zones/${zoneId}/pricing/${pricingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carrier", carrierId] }),
  });
}
```

---

## Task 13: Create `CarrierTable` Component

**Files:**
- Create: `src/components/carriers/carrier-table.tsx`

**Step 1: Create `src/components/carriers/carrier-table.tsx`**
```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteCarrier } from "@/hooks/use-carriers";
import type { Carrier } from "@/lib/db/schema";

interface CarrierTableProps {
  carriers: Carrier[];
}

export function CarrierTable({ carriers }: CarrierTableProps) {
  const router = useRouter();
  const deleteCarrier = useDeleteCarrier();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {carriers.map((carrier) => (
          <TableRow key={carrier.id}>
            <TableCell className="font-medium">{carrier.name}</TableCell>
            <TableCell className="text-muted-foreground">{carrier.slug}</TableCell>
            <TableCell>
              <Badge variant={carrier.isActive ? "default" : "secondary"}>
                {carrier.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/carriers/${carrier.id}`)}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteCarrier.isPending}
                onClick={() => deleteCarrier.mutate(carrier.id)}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {carriers.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No carriers yet. Add your first carrier.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
```

---

## Task 14: Create `CarrierForm` Component

**Files:**
- Create: `src/components/carriers/carrier-form.tsx`

**Step 1: Create `src/components/carriers/carrier-form.tsx`**
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateCarrierSchema, type CreateCarrierInput } from "@/lib/validations/carriers";
import { useCreateCarrier, useUpdateCarrier } from "@/hooks/use-carriers";
import type { Carrier } from "@/lib/db/schema";

interface CarrierFormProps {
  carrier?: Carrier; // if provided → edit mode
}

export function CarrierForm({ carrier }: CarrierFormProps) {
  const router = useRouter();
  const createCarrier = useCreateCarrier();
  const updateCarrier = useUpdateCarrier(carrier?.id ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCarrierInput>({
    resolver: zodResolver(CreateCarrierSchema),
    defaultValues: carrier
      ? { name: carrier.name, slug: carrier.slug, logoUrl: carrier.logoUrl ?? undefined }
      : undefined,
  });

  const onSubmit = async (data: CreateCarrierInput) => {
    if (carrier) {
      await updateCarrier.mutateAsync(data);
    } else {
      await createCarrier.mutateAsync(data);
    }
    router.push("/admin/carriers");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} placeholder="Amana" />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" {...register("slug")} placeholder="amana" />
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input id="logoUrl" {...register("logoUrl")} placeholder="https://..." />
        {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {carrier ? "Update Carrier" : "Create Carrier"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

---

## Task 15: Create `ZoneAccordion` + `PricingRow` Components

**Files:**
- Create: `src/components/carriers/zone-accordion.tsx`

**Step 1: Create `src/components/carriers/zone-accordion.tsx`**
```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreateZoneSchema,
  CreatePricingSchema,
  type CreateZoneInput,
  type CreatePricingInput,
} from "@/lib/validations/carriers";
import {
  useCreateZone,
  useDeleteZone,
  useCreatePricing,
  useDeletePricing,
} from "@/hooks/use-carriers";
import type { CarrierZone, CarrierPricing } from "@/lib/db/schema";

interface ZoneWithPricing extends CarrierZone {
  pricing: CarrierPricing[];
}

interface ZoneAccordionProps {
  carrierId: string;
  zones: ZoneWithPricing[];
}

export function ZoneAccordion({ carrierId, zones }: ZoneAccordionProps) {
  const createZone = useCreateZone(carrierId);
  const deleteZone = useDeleteZone(carrierId);
  const [showZoneForm, setShowZoneForm] = useState(false);

  const zoneForm = useForm<CreateZoneInput>({
    resolver: zodResolver(CreateZoneSchema),
  });

  const onCreateZone = async (data: CreateZoneInput) => {
    await createZone.mutateAsync(data);
    zoneForm.reset();
    setShowZoneForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Zones & Pricing</h3>
        <Button size="sm" variant="outline" onClick={() => setShowZoneForm(!showZoneForm)}>
          + Add Zone
        </Button>
      </div>

      {showZoneForm && (
        <form onSubmit={zoneForm.handleSubmit(onCreateZone)} className="flex gap-2 items-end">
          <div>
            <Label>Zone Name</Label>
            <Input {...zoneForm.register("zoneName")} placeholder="Grand Casablanca" />
          </div>
          <div>
            <Label>Zone Code</Label>
            <Input {...zoneForm.register("zoneCode")} placeholder="ZA" className="w-24" />
          </div>
          <Button type="submit" size="sm" disabled={createZone.isPending}>Add</Button>
        </form>
      )}

      <Accordion type="multiple" className="w-full">
        {zones.map((zone) => (
          <AccordionItem key={zone.id} value={zone.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">{zone.zoneName}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {zone.zoneCode}
                </span>
                <span className="text-xs text-muted-foreground">
                  {zone.pricing.length} pricing row{zone.pricing.length !== 1 ? "s" : ""}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <PricingSection
                carrierId={carrierId}
                zone={zone}
                onDeleteZone={() => deleteZone.mutate(zone.id)}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

interface PricingSectionProps {
  carrierId: string;
  zone: ZoneWithPricing;
  onDeleteZone: () => void;
}

function PricingSection({ carrierId, zone, onDeleteZone }: PricingSectionProps) {
  const createPricing = useCreatePricing(carrierId, zone.id);
  const deletePricing = useDeletePricing(carrierId, zone.id);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<CreatePricingInput>({
    resolver: zodResolver(CreatePricingSchema),
  });

  const onSubmit = async (data: CreatePricingInput) => {
    await createPricing.mutateAsync(data);
    form.reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-3 pt-2">
      {zone.pricing.map((row) => (
        <div key={row.id} className="flex items-center gap-4 text-sm bg-muted/50 rounded p-2">
          <span>{row.weightMinG}g – {row.weightMaxG ?? "∞"}g</span>
          <span className="font-medium">{(row.priceMad / 100).toFixed(2)} MAD</span>
          <span className="text-muted-foreground">{row.deliveryDaysMin}–{row.deliveryDaysMax} days</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={() => deletePricing.mutate(row.id)}
          >
            Remove
          </Button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Min weight (g)</Label>
            <Input type="number" {...form.register("weightMinG", { valueAsNumber: true })} />
          </div>
          <div>
            <Label className="text-xs">Max weight (g, blank = ∞)</Label>
            <Input type="number" {...form.register("weightMaxG", { valueAsNumber: true })} />
          </div>
          <div>
            <Label className="text-xs">Price (centimes)</Label>
            <Input type="number" {...form.register("priceMad", { valueAsNumber: true })} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <Label className="text-xs">Min days</Label>
              <Input type="number" {...form.register("deliveryDaysMin", { valueAsNumber: true })} />
            </div>
            <div>
              <Label className="text-xs">Max days</Label>
              <Input type="number" {...form.register("deliveryDaysMax", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="col-span-2 flex gap-2">
            <Button size="sm" type="submit" disabled={createPricing.isPending}>Add Row</Button>
            <Button size="sm" variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>+ Add Pricing Row</Button>
      )}

      <Button
        size="sm"
        variant="destructive"
        onClick={onDeleteZone}
        disabled={zone.pricing.length > 0}
        title={zone.pricing.length > 0 ? "Delete all pricing rows first" : undefined}
      >
        Delete Zone
      </Button>
    </div>
  );
}
```

---

## Task 16: Admin Carrier List Page (RSC)

**Files:**
- Create: `src/app/(dashboard)/admin/carriers/page.tsx`

**Step 1: Create `src/app/(dashboard)/admin/carriers/page.tsx`**
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CarrierTable } from "@/components/carriers/carrier-table";
import { listCarriers } from "@/lib/services/carriers";

export default async function AdminCarriersPage() {
  const carriers = await listCarriers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Carriers</h1>
          <p className="text-muted-foreground">{carriers.length} carrier{carriers.length !== 1 ? "s" : ""} configured</p>
        </div>
        <Button asChild>
          <Link href="/admin/carriers/new">+ Add Carrier</Link>
        </Button>
      </div>
      <CarrierTable carriers={carriers} />
    </div>
  );
}
```

---

## Task 17: Admin Carrier New Page

**Files:**
- Create: `src/app/(dashboard)/admin/carriers/new/page.tsx`

**Step 1: Create `src/app/(dashboard)/admin/carriers/new/page.tsx`**
```tsx
import { CarrierForm } from "@/components/carriers/carrier-form";

export default function NewCarrierPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Carrier</h1>
        <p className="text-muted-foreground">Add a carrier to the Wassalha network</p>
      </div>
      <CarrierForm />
    </div>
  );
}
```

---

## Task 18: Admin Carrier Edit Page

**Files:**
- Create: `src/app/(dashboard)/admin/carriers/[id]/page.tsx`

**Step 1: Create `src/app/(dashboard)/admin/carriers/[id]/page.tsx`**
```tsx
import { notFound } from "next/navigation";
import { CarrierForm } from "@/components/carriers/carrier-form";
import { ZoneAccordion } from "@/components/carriers/zone-accordion";
import { getCarrierById } from "@/lib/services/carriers";
import type { CarrierZone, CarrierPricing } from "@/lib/db/schema";

interface CarrierWithZones {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  zones: (CarrierZone & { pricing: CarrierPricing[] })[];
}

export default async function EditCarrierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carrier = await getCarrierById(id) as CarrierWithZones | undefined;

  if (!carrier) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Edit Carrier</h1>
        <p className="text-muted-foreground">{carrier.name}</p>
      </div>
      <CarrierForm carrier={carrier} />
      <hr />
      <ZoneAccordion carrierId={carrier.id} zones={carrier.zones} />
    </div>
  );
}
```

---

## Task 19: Create `AddressAutocomplete` Component

**Files:**
- Create: `src/components/forms/address-autocomplete.tsx`

**Step 1: Create `src/components/forms/address-autocomplete.tsx`**
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";

export interface AddressValue {
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange: (value: AddressValue) => void;
  placeholder?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address...",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? "");

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setFallback(true);
      return;
    }

    const loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });

    loader.load().then((google) => {
      if (!inputRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "ma" }, // Morocco only
        fields: ["formatted_address", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location || !place.formatted_address) return;
        onChange({
          address: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
        setInputValue(place.formatted_address);
      });
    }).catch(() => setFallback(true));
  }, [onChange]);

  if (fallback) {
    // Plain text fallback — no Google Maps API key or quota exceeded
    return (
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange({ address: e.target.value, lat: 0, lng: 0 });
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      defaultValue={value}
      placeholder={placeholder}
    />
  );
}
```

> **Usage in forms (Phase 4):**
> ```tsx
> <AddressAutocomplete
>   onChange={(val) => setValue("pickupAddress", val)}
> />
> ```

---

## Task 20: Update Dashboard Layout — Admin Nav Link

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Read current layout and add Carriers link**

In `src/app/(dashboard)/layout.tsx`, import Clerk's `currentUser` (or use `auth()`) to read the role, then conditionally render the admin nav link:

```tsx
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
// ... existing imports

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";

  return (
    <div>
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg">Wassalha</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            {isAdmin && (
              <Link href="/admin/carriers" className="text-muted-foreground hover:text-foreground">
                Carriers
              </Link>
            )}
          </nav>
        </div>
        {/* existing UserButton */}
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
```

> **Note:** Read the actual current layout file before editing — match the existing JSX structure. Only add the nav block; don't rewrite the layout.

---

## Task 21: Final Verification

**Step 1: Type check**
```bash
pnpm typecheck
```
Expected: 0 errors.

**Step 2: Lint**
```bash
pnpm lint
```
Expected: 0 errors.

**Step 3: Test**
```bash
pnpm test:run
```
Expected: All existing tests pass (8 tests from Phase 1).

**Step 4: Build**
```bash
pnpm build
```
Expected: Build succeeds. Pages generated include `/admin/carriers`, `/admin/carriers/new`, `/admin/carriers/[id]`.

**Step 5: Smoke test (manual)**
1. Run `pnpm dev` and navigate to `http://localhost:3000`
2. Sign in as admin → confirm "Carriers" nav link appears
3. Navigate to `/admin/carriers` → carrier list shows seeded carriers
4. Click "Edit" on Amana → zones + pricing accordion visible
5. Create a new carrier → appears in list
6. Sign in as retailer → confirm "Carriers" nav link is hidden
7. Attempt `POST /api/carriers` as retailer → expect `403`

---

## Notes for Implementer

- **Prices in centimes:** All `priceMad` values are stored as integers in centimes (1/100 MAD). Display by dividing by 100. Example: `2500` = `25.00 MAD`.
- **Drizzle relations:** The `with:` syntax in `db.query` requires relations to be defined in the schema. Task 5 Step 2 adds them — don't skip this.
- **Admin route protection:** The middleware (`src/middleware.ts`) already guards `/admin/*` routes. API route handlers do a second Clerk check for defense-in-depth.
- **AddressAutocomplete wired in Phase 4:** The component is built now but not used in any form yet. It will be imported in the shipment booking form.
- **`pnpm db:studio`** — Use this to inspect seeded data visually after running `pnpm db:seed`.
