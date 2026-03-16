/**
 * Edge Case 2: Shipment with status=delivered must NOT be polled by cron.
 *
 * Strategy:
 *  - Take an existing shipment, temporarily set status=delivered + created_at=today
 *  - Trigger cron → expect processed=0 (terminal status excluded from ACTIVE_STATUSES)
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
  const all = await db.query.shipments.findMany({
    columns: { id: true, status: true, createdAt: true },
    limit: 1,
  });

  if (all.length === 0) {
    console.error("No shipments in DB.");
    process.exit(1);
  }

  const target = all[0];
  const origStatus = target.status;
  const origCreatedAt = target.createdAt;

  console.log(`\n[setup] Using shipment ${target.id.slice(0, 8)}… (status=${origStatus})`);

  // 1. Set status=delivered, created_at=today (fresh — not stale, so age filter won't interfere)
  const today = new Date();
  console.log(`[mutate] status → delivered, created_at → ${today.toISOString()}`);
  await db
    .update(shipments)
    .set({ status: "delivered", createdAt: today })
    .where(sql`${shipments.id} = ${target.id}`);

  // 2. Trigger cron
  console.log("\n[cron] Calling GET /api/cron/tracking …");
  const res = await fetch("http://localhost:3000/api/cron/tracking", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = (await res.json()) as { ok: boolean; processed: number; errors: number };
  console.log(`[cron] Response:`, body);

  // 3. Assert: processed=0 — delivered is not in ACTIVE_STATUSES
  let pass = true;
  if (body.processed !== 0) {
    console.error(`\n❌ FAIL: expected processed=0 but got processed=${body.processed}`);
    pass = false;
  } else {
    console.log(`\n✅ PASS: processed=0 — delivered shipment correctly excluded (terminal status)`);
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
