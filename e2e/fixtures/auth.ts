import { clerk } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'

/**
 * Signs in as a test retailer user.
 * Requires E2E_RETAILER_EMAIL env var — a Clerk test user with no publicMetadata.role.
 * Uses Clerk's testing token strategy (email_code bypass for +clerk_test users).
 */
export async function asRetailer(page: Page): Promise<void> {
  await page.goto('/sign-in')
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'email_code',
      identifier: process.env.E2E_RETAILER_EMAIL!,
    },
  })
}

/**
 * Signs in as a test admin user.
 * Requires E2E_ADMIN_EMAIL env var — a Clerk test user with publicMetadata: { "role": "admin" }.
 */
export async function asAdmin(page: Page): Promise<void> {
  await page.goto('/sign-in')
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'email_code',
      identifier: process.env.E2E_ADMIN_EMAIL!,
    },
  })
}

/**
 * Returns true when Clerk credentials are properly configured for e2e tests.
 * Tests that need auth skip themselves when this returns false.
 */
export function hasClerkCredentials(): boolean {
  const email = process.env.E2E_RETAILER_EMAIL ?? ''
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? ''
  return (
    email.includes('+clerk_test') &&
    email !== 'retailer+clerk_test@example.com' &&
    adminEmail.includes('+clerk_test') &&
    adminEmail !== 'admin+clerk_test@example.com'
  )
}
