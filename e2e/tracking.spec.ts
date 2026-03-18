import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Shipment tracking', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('shipment detail page renders tracking timeline', async ({ page }) => {
    // Navigate to shipments list first
    await page.goto('/shipments')

    // Wait for loading to resolve (TanStack Query fetch)
    await page.getByText(/chargement/i).waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})

    // If no shipments yet, verify the empty state renders without error and skip tracking
    const hasTable = await page.getByTestId('shipments-table').isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasTable) {
      await expect(page.getByText(/aucun envoi/i)).toBeVisible({ timeout: 5_000 })
      return
    }

    // Click first shipment row
    const firstRow = page.getByTestId('shipment-row').first()
    await expect(firstRow).toBeVisible()
    await firstRow.getByRole('link', { name: /voir suivi/i }).click()

    // Shipment detail — tracking timeline must render
    await expect(page).toHaveURL(/\/shipments\//, { timeout: 15_000 })
    await expect(page.getByTestId('tracking-timeline')).toBeVisible({ timeout: 10_000 })
  })
})
