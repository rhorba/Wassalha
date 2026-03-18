import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('new retailer completes onboarding wizard', async ({ page }) => {
    await page.goto('/onboarding')

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
})
