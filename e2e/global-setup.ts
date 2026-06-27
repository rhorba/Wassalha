import { clerkSetup } from '@clerk/testing/playwright'

export default async function globalSetup() {
  try {
    await clerkSetup()
  } catch (err) {
    // Clerk setup fails when using placeholder keys or without real Clerk credentials.
    // Tests that rely on Clerk auth (asRetailer/asAdmin) will be skipped gracefully.
    console.warn(
      '[global-setup] Clerk setup failed — auth tests will be skipped.',
      err instanceof Error ? err.message : String(err)
    )
  }
}
