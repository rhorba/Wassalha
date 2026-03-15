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
    expect(seeded.length).toBeGreaterThanOrEqual(5);

    const slugs = seeded.map((c) => c.slug);
    expect(slugs).toContain("amana");
    expect(slugs).toContain("aramex");
    expect(slugs).toContain("ctm");
    expect(slugs).toContain("marocolis");
    expect(slugs).toContain("sendex");
  });

  it("priceMad is stored in centimes (integer)", async () => {
    const carrier = await db.query.carriers.findFirst({
      where: eq(carriers.slug, "amana"),
      with: { zones: { with: { pricing: true } } },
    });
    expect(carrier).toBeDefined();
    const allPrices = carrier!.zones.flatMap((z) => z.pricing.map((p) => p.priceMad));
    allPrices.forEach((price) => {
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(100);
    });
  });
});
