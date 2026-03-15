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
    name: "Aramex",
    slug: "aramex",
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
    name: "Marocolis",
    slug: "marocolis",
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
    name: "Sendex",
    slug: "sendex",
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
