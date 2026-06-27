import { clerkSetup } from '@clerk/testing/playwright'
import { writeFileSync, unlinkSync } from 'fs'

// Written when clerkSetup() succeeds so test workers can check it via hasClerkCredentials()
const SENTINEL = 'e2e/.clerk-setup-ok'

export default async function globalSetup() {
  // Remove stale sentinel from previous run
  try { unlinkSync(SENTINEL) } catch {}

  try {
    await clerkSetup()
    writeFileSync(SENTINEL, '1')
  } catch (err) {
    // Clerk setup fails when using placeholder keys or without real Clerk credentials.
    // Tests that rely on Clerk auth (asRetailer/asAdmin) will be skipped gracefully.
    console.warn(
      '[global-setup] Clerk setup failed — auth tests will be skipped.',
      err instanceof Error ? err.message : String(err)
    )
  }
}
