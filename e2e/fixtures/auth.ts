import { clerk } from '@clerk/testing/playwright'
import { type Page } from '@playwright/test'

/**
 * Signs in as a test retailer user.
 * Requires E2E_RETAILER_EMAIL env var — a Clerk test user with no publicMetadata.role.
 * Must call page.goto('/') before calling this so Clerk is loaded.
 */
export async function asRetailer(page: Page): Promise<void> {
  await page.goto('/')
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
 * Must call page.goto('/') before calling this so Clerk is loaded.
 */
export async function asAdmin(page: Page): Promise<void> {
  await page.goto('/')
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'email_code',
      identifier: process.env.E2E_ADMIN_EMAIL!,
    },
  })
}
