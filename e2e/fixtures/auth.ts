import { clerk } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'
import { existsSync } from 'fs'

// Sentinel written by global-setup when clerkSetup() succeeds — relative to project root (cwd)
const SENTINEL = 'e2e/.clerk-setup-ok'
const AUTH_TIMEOUT = 25_000

/**
 * Signs in as a test retailer user.
 * Requires E2E_RETAILER_EMAIL env var — a Clerk test user with no publicMetadata.role.
 * Uses Clerk's testing token strategy (email_code bypass for +clerk_test users).
 * Rejects after 25s so beforeEach can catch it and skip the test rather than hang.
 */
export async function asRetailer(page: Page): Promise<void> {
  await page.goto('/sign-in')
  await Promise.race([
    clerk.signIn({
      page,
      signInParams: {
        strategy: 'email_code',
        identifier: process.env.E2E_RETAILER_EMAIL!,
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Retailer sign-in timeout after 25s')), AUTH_TIMEOUT)
    ),
  ])
}

/**
 * Signs in as a test admin user.
 * Requires E2E_ADMIN_EMAIL env var — a Clerk test user with publicMetadata: { "role": "admin" }.
 * Rejects after 25s so beforeEach can catch it and skip the test rather than hang.
 */
export async function asAdmin(page: Page): Promise<void> {
  await page.goto('/sign-in')
  await Promise.race([
    clerk.signIn({
      page,
      signInParams: {
        strategy: 'email_code',
        identifier: process.env.E2E_ADMIN_EMAIL!,
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Admin sign-in timeout after 25s')), AUTH_TIMEOUT)
    ),
  ])
}

/**
 * Returns true when Clerk credentials are properly configured for e2e tests.
 * Checks both email addresses AND whether clerkSetup() succeeded in global-setup.
 * Tests that need auth skip themselves when this returns false.
 */
export function hasClerkCredentials(): boolean {
  const email = process.env.E2E_RETAILER_EMAIL ?? ''
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? ''
  const hasEmails = (
    email.includes('+clerk_test') &&
    email !== 'retailer+clerk_test@example.com' &&
    adminEmail.includes('+clerk_test') &&
    adminEmail !== 'admin+clerk_test@example.com'
  )
  if (!hasEmails) return false
  // Also verify that clerkSetup() succeeded in global-setup
  try {
    return existsSync(SENTINEL)
  } catch {
    return false
  }
}
