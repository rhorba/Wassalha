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
