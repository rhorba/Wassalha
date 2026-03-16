import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()), true);

import { db } from "../src/lib/db";

async function run() {
  const all = await db.query.shipments.findMany({
    columns: { id: true, status: true, createdAt: true, carrierTrackingNumber: true },
    with: { carrier: { columns: { name: true, slug: true } } },
  });
  console.log(`Total shipments: ${all.length}`);
  all.forEach((s) =>
    console.log(
      `  id=${s.id.slice(0, 8)}… carrier=${s.carrier.slug} status=${s.status} createdAt=${s.createdAt.toISOString()} tracking=${s.carrierTrackingNumber ?? "—"}`,
    ),
  );
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
