/**
 * Edge Case 4: Duplicate cron run must NOT produce duplicate tracking_events rows.
 *
 * Strategy:
 *  - Set one shipment to in_transit + today (so cron picks it up)
 *  - Trigger cron → N events written
 *  - Trigger cron again → same N events (onConflictDoNothing prevents dupes)
 *  - Assert: count before second run === count after second run
 *  - Restore shipment
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()), true);

import { eq, sql, count } from "drizzle-orm";
import { db } from "../src/lib/db";
import { shipments, trackingEvents, carriers } from "../src/lib/db/schema";

const CRON_SECRET = process.env.CRON_SECRET!;

async function cronTrigger() {
  const res = await fetch("http://localhost:3000/api/cron/tracking", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  return res.json() as Promise<{ ok: boolean; processed: number; errors: number }>;
}

async function eventCount(shipmentId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(trackingEvents)
    .where(eq(trackingEvents.shipmentId, shipmentId));
  return rows[0]?.n ?? 0;
}

async function run() {
  // Find aramex carrier
  const aramex = await db.query.carriers.findFirst({
    where: eq(carriers.slug, "aramex"),
    columns: { id: true },
  });
  if (!aramex) { console.error("No aramex carrier."); process.exit(1); }

  // Pick first shipment
  const ship = await db.query.shipments.findFirst({
    columns: { id: true, status: true, createdAt: true, carrierId: true },
  });
  if (!ship) { console.error("No shipments in DB."); process.exit(1); }

  const origStatus    = ship.status;
  const origCreatedAt = ship.createdAt;
  const origCarrierId = ship.carrierId;

  console.log(`\n[setup] Shipment ${ship.id.slice(0, 8)}… → in_transit, carrier=aramex, created_at=today`);
  await db.update(shipments)
    .set({ status: "in_transit", carrierId: aramex.id, createdAt: new Date() })
    .where(sql`${shipments.id} = ${ship.id}`);

  // Count events before first cron run
  const countBefore = await eventCount(ship.id);
  console.log(`[before] tracking_events for this shipment: ${countBefore}`);

  // First cron run
  console.log("\n[cron #1] Triggering …");
  const r1 = await cronTrigger();
  console.log("[cron #1] Response:", r1);

  const countAfter1 = await eventCount(ship.id);
  console.log(`[after #1] tracking_events: ${countAfter1}  (new rows: ${countAfter1 - countBefore})`);

  // Second cron run (duplicate)
  console.log("\n[cron #2] Triggering (duplicate) …");
  const r2 = await cronTrigger();
  console.log("[cron #2] Response:", r2);

  const countAfter2 = await eventCount(ship.id);
  console.log(`[after #2] tracking_events: ${countAfter2}  (new rows: ${countAfter2 - countAfter1})`);

  // Assert: no new rows after second run
  let pass = true;
  if (countAfter2 !== countAfter1) {
    console.error(`\n❌ FAIL: count grew from ${countAfter1} → ${countAfter2} on second cron run (duplicates inserted)`);
    pass = false;
  } else {
    console.log(`\n✅ PASS: count stable at ${countAfter2} — onConflictDoNothing prevented duplicate rows`);
  }

  // Restore
  console.log(`\n[restore] status → ${origStatus}, carrierId → original, created_at → original`);
  await db.update(shipments)
    .set({ status: origStatus, carrierId: origCarrierId, createdAt: origCreatedAt })
    .where(sql`${shipments.id} = ${ship.id}`);
  console.log("[restore] Done.\n");

  process.exit(pass ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
