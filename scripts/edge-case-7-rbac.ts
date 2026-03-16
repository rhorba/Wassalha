/**
 * Edge Case 7: Retailer accessing another user's shipment → returns null (→ 404).
 *
 * Tests the RBAC check in getShipmentById directly (bypassing Clerk auth).
 * The service layer is the enforcement point — the page calls notFound() on null.
 *
 * Cases tested:
 *  A. Correct owner, role=retailer       → shipment returned
 *  B. Wrong userId, role=retailer        → null (RBAC blocked)
 *  C. Wrong userId, role=admin           → shipment returned (admin sees all)
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()), true);

import { getShipmentById } from "../src/lib/services/bookings";

async function run() {
  // Get a real shipment to work with
  const { db } = await import("../src/lib/db");
  const ship = await db.query.shipments.findFirst({
    columns: { id: true, userId: true },
  });

  if (!ship) { console.error("No shipments in DB."); process.exit(1); }

  const realOwner   = ship.userId;
  const wrongUserId = "fake-user-id-that-does-not-exist";

  console.log(`\n[setup] shipmentId=${ship.id.slice(0, 8)}…  realOwner=${realOwner.slice(0, 12)}…\n`);

  let pass = true;

  // Case A: correct owner + retailer role → should return shipment
  const resultA = await getShipmentById(ship.id, realOwner, "retailer");
  if (resultA === null) {
    console.error("❌ Case A FAIL: correct owner got null (should have returned shipment)");
    pass = false;
  } else {
    console.log("✅ Case A PASS: correct owner (retailer) → shipment returned");
  }

  // Case B: wrong userId + retailer role → should return null
  const resultB = await getShipmentById(ship.id, wrongUserId, "retailer");
  if (resultB !== null) {
    console.error("❌ Case B FAIL: wrong userId got shipment (RBAC not enforced)");
    pass = false;
  } else {
    console.log("✅ Case B PASS: wrong userId (retailer) → null → notFound() would fire");
  }

  // Case C: wrong userId + admin role → should return shipment (admin bypasses ownership check)
  const resultC = await getShipmentById(ship.id, wrongUserId, "admin");
  if (resultC === null) {
    console.error("❌ Case C FAIL: admin got null (admin should see all shipments)");
    pass = false;
  } else {
    console.log("✅ Case C PASS: wrong userId (admin) → shipment returned (admin bypass correct)");
  }

  console.log(pass ? "\n✅ All RBAC cases passed." : "\n❌ Some RBAC cases failed.");
  process.exit(pass ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
