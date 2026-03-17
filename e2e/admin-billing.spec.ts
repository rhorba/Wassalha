import { test, expect } from '@playwright/test'
import { asAdmin } from './fixtures/auth'

test.describe('Admin billing', () => {
  test.beforeEach(async ({ page }) => {
    await asAdmin(page)
  })

  test('admin can view billing page', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByRole('heading', { name: /facturation/i })).toBeVisible()
    // Table or empty state renders without 500
    await expect(
      page.getByTestId('billing-table').or(page.getByText(/aucune commission/i))
    ).toBeVisible({ timeout: 10_000 })
  })
})
