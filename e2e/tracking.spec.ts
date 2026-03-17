import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Shipment tracking', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('shipment detail page renders tracking timeline', async ({ page }) => {
    // Navigate to shipments list first
    await page.goto('/shipments')
    await expect(page.getByTestId('shipments-table')).toBeVisible({ timeout: 10_000 })

    // Click first shipment row
    const firstRow = page.getByTestId('shipment-row').first()
    await expect(firstRow).toBeVisible()
    await firstRow.getByRole('link', { name: /voir suivi/i }).click()

    // Shipment detail — tracking timeline must render
    await expect(page).toHaveURL(/\/shipments\//)
    await expect(page.getByTestId('tracking-timeline')).toBeVisible({ timeout: 10_000 })
  })
})
