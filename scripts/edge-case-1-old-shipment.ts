/**
 * Edge Case 1: Shipment older than 14 days must NOT be polled by cron.
 *
 * Strategy (no active shipments exist):
 *  - Take an existing shipment, temporarily set status=in_transit + created_at=15d ago
 *  - Trigger cron → expect processed=0 (stale, excluded from query)
 *  - Restore original status + created_at
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()), true);

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { shipments } from "../src/lib/db/schema";

const CRON_SECRET = process.env.CRON_SECRET!;

async function run() {
  // Pick any shipment
  const all = await db.query.shipments.findMany({
    columns: { id: true, status: true, createdAt: true },
    limit: 1,
  });

  if (all.length === 0) {
    console.error("No shipments in DB. Book one first via /compare.");
    process.exit(1);
  }

  const target = all[0];
  const origStatus = target.status;
  const origCreatedAt = target.createdAt;

  console.log(`\n[setup] Using shipment ${target.id.slice(0, 8)}… (status=${origStatus}, createdAt=${origCreatedAt.toISOString()})`);

  // 1. Set to active status + 15 days old
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 15);

  console.log(`[mutate] status → in_transit, created_at → ${staleDate.toISOString()}`);
  await db
    .update(shipments)
    .set({ status: "in_transit", createdAt: staleDate })
    .where(sql`${shipments.id} = ${target.id}`);

  // 2. Trigger cron — the shipment is active-status but stale → should NOT be polled
  console.log("\n[cron] Calling GET /api/cron/tracking …");
  const res = await fetch("http://localhost:3000/api/cron/tracking", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = (await res.json()) as { ok: boolean; processed: number; errors: number };
  console.log(`[cron] Response:`, body);

  // 3. Assert: processed should be 0 (our stale shipment is excluded; no other active ones)
  const expected = 0;
  let pass = true;
  if (body.processed !== expected) {
    console.error(`\n❌ FAIL: expected processed=${expected} but got processed=${body.processed}`);
    pass = false;
  } else {
    console.log(`\n✅ PASS: processed=${body.processed} — shipment older than 14 days was correctly excluded from poll`);
  }

  // 4. Restore
  console.log(`\n[restore] status → ${origStatus}, created_at → ${origCreatedAt.toISOString()}`);
  await db
    .update(shipments)
    .set({ status: origStatus, createdAt: origCreatedAt })
    .where(sql`${shipments.id} = ${target.id}`);
  console.log("[restore] Done.\n");

  process.exit(pass ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
