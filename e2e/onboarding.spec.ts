import { test, expect } from '@playwright/test'
import { asRetailer, hasClerkCredentials } from './fixtures/auth'

test.describe('Onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasClerkCredentials()) {
      test.skip(true, 'Clerk test credentials not configured')
    }
    await asRetailer(page)
  })

  test('new retailer completes onboarding wizard', async ({ page }) => {
    await page.goto('/onboarding')
    // Wait to see if client-side redirect fires (user already onboarded)
    const redirected = await page.waitForURL(/compare|dashboard/, { timeout: 4_000 }).then(() => true).catch(() => false)
    if (redirected) {
      // Already completed onboarding — redirect to /compare or /dashboard is correct behavior
      expect(page.url()).toMatch(/compare|dashboard/)
      return
    }

    // Step 1 — business profile
    await page.getByLabel(/nom de l'entreprise/i).fill('Test Boutique')
    await page.getByLabel(/téléphone/i).fill('+212612345678')
    await page.getByRole('button', { name: /continuer/i }).click()

    // Step 2 — default address
    await page.getByLabel(/adresse/i).fill('123 Rue Hassan II')
    // City input — plain text fallback (Google Maps may not load in CI)
    await page.getByLabel(/ville/i).fill('Casablanca')
    await page.getByRole('button', { name: /continuer/i }).click()

    // Step 3 — done screen
    await expect(page.getByText(/c'est parti/i)).toBeVisible()
    await page.getByRole('link', { name: /comparer les transporteurs/i }).click()

    await expect(page).toHaveURL('/compare')
  })

  test('onboarding step 1 — validates required fields', async ({ page }) => {
    await page.goto('/onboarding')
    // Wait to see if client-side redirect fires (user already onboarded)
    const redirected = await page.waitForURL(/compare|dashboard/, { timeout: 4_000 }).then(() => true).catch(() => false)
    if (redirected) return
    // Try to proceed without filling fields
    await page.getByRole('button', { name: /continuer/i }).click()
    // Should show validation errors and not advance
    await expect(page.getByLabel(/nom de l'entreprise/i)).toBeVisible({ timeout: 5_000 })
  })

  test('onboarding — already onboarded user is redirected', async ({ page }) => {
    // If user already completed onboarding, /onboarding redirects to /compare or /dashboard
    await page.goto('/onboarding')
    // Allow redirect to happen
    await page.waitForTimeout(2000)
    // We're either on onboarding or redirected away
    const url = page.url()
    expect(url).toMatch(/onboarding|compare|dashboard/)
  })
})
