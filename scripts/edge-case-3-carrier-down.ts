/**
 * Edge Case 3: Carrier API down → errors:1, OTHER shipments still processed.
 *
 * Strategy:
 *  - Two active shipments needed: one aramex (mock works), one stub carrier (always throws)
 *  - Temporarily set both to in_transit + today's created_at
 *  - Shipment A → aramex carrier (mock returns events) → success
 *  - Shipment B → amana/ctm/etc carrier (stub throws SERVICE_UNAVAILABLE) → error
 *  - Expect: processed=2, errors=1
 *  - Restore both
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()), true);

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { shipments, carriers } from "../src/lib/db/schema";

const CRON_SECRET = process.env.CRON_SECRET!;

async function run() {
  // Find one aramex carrier and one stub carrier (amana/ctm/marocolis/sendex)
  const allCarriers = await db.query.carriers.findMany({
    columns: { id: true, slug: true, name: true },
  });
  console.log("\n[carriers]", allCarriers.map((c) => `${c.slug}(${c.id.slice(0, 8)}…)`).join(", "));

  const aramex = allCarriers.find((c) => c.slug === "aramex");
  const stub   = allCarriers.find((c) => ["amana", "ctm", "marocolis", "sendex"].includes(c.slug));

  if (!aramex) { console.error("No aramex carrier in DB."); process.exit(1); }
  if (!stub)   { console.error("No stub carrier (amana/ctm/marocolis/sendex) in DB."); process.exit(1); }

  console.log(`[setup] Working carrier: ${aramex.slug}  |  Stub carrier: ${stub.slug}`);

  // Get the 2 existing shipments
  const all = await db.query.shipments.findMany({
    columns: { id: true, status: true, createdAt: true, carrierId: true, carrierTrackingNumber: true },
  });

  if (all.length < 2) {
    console.error("Need at least 2 shipments in DB. Only found:", all.length);
    process.exit(1);
  }

  const shipA = all[0]; // will be aramex
  const shipB = all[1]; // will be stub

  // Backup originals
  const origA = { status: shipA.status, createdAt: shipA.createdAt, carrierId: shipA.carrierId };
  const origB = { status: shipB.status, createdAt: shipB.createdAt, carrierId: shipB.carrierId };

  const today = new Date();

  console.log(`\n[mutate] Shipment A (${shipA.id.slice(0, 8)}…) → in_transit, carrier=aramex, created_at=today`);
  await db.update(shipments)
    .set({ status: "in_transit", carrierId: aramex.id, createdAt: today })
    .where(sql`${shipments.id} = ${shipA.id}`);

  console.log(`[mutate] Shipment B (${shipB.id.slice(0, 8)}…) → in_transit, carrier=${stub.slug}, created_at=today`);
  await db.update(shipments)
    .set({ status: "in_transit", carrierId: stub.id, createdAt: today })
    .where(sql`${shipments.id} = ${shipB.id}`);

  // Trigger cron
  console.log("\n[cron] Calling GET /api/cron/tracking …");
  const res = await fetch("http://localhost:3000/api/cron/tracking", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = (await res.json()) as { ok: boolean; processed: number; errors: number };
  console.log(`[cron] Response:`, body);

  // Assert: processed=2, errors=1
  let pass = true;
  if (body.processed !== 2) {
    console.error(`❌ FAIL: expected processed=2, got ${body.processed}`);
    pass = false;
  }
  if (body.errors !== 1) {
    console.error(`❌ FAIL: expected errors=1, got ${body.errors}`);
    pass = false;
  }
  if (pass) {
    console.log(`\n✅ PASS: processed=${body.processed}, errors=${body.errors}`);
    console.log(`   → Aramex shipment processed successfully despite ${stub.slug} adapter being down`);
  }

  // Restore
  console.log(`\n[restore] Shipment A → status=${origA.status}, carrierId=original, created_at=original`);
  await db.update(shipments)
    .set({ status: origA.status, carrierId: origA.carrierId, createdAt: origA.createdAt })
    .where(sql`${shipments.id} = ${shipA.id}`);

  console.log(`[restore] Shipment B → status=${origB.status}, carrierId=original, created_at=original`);
  await db.update(shipments)
    .set({ status: origB.status, carrierId: origB.carrierId, createdAt: origB.createdAt })
    .where(sql`${shipments.id} = ${shipB.id}`);

  console.log("[restore] Done.\n");
  process.exit(pass ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
