import { test, expect } from '@playwright/test'
import { asAdmin, hasClerkCredentials } from './fixtures/auth'

test.describe('Admin billing', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasClerkCredentials()) {
      test.skip(true, 'Clerk test credentials not configured')
    }
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

  test('admin can view carriers management page', async ({ page }) => {
    await page.goto('/admin/carriers')
    await expect(page.getByRole('heading', { name: /carriers/i })).toBeVisible({ timeout: 10_000 })
    // Table with carriers or add button
    await expect(
      page.getByTestId('carrier-table').or(page.getByRole('button', { name: /add carrier/i })).or(page.locator('table'))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('admin can view audit logs', async ({ page }) => {
    await page.goto('/admin/audit-logs')
    // Page renders without 500
    const body = page.locator('body')
    await expect(body).toBeVisible()
    await expect(page.getByText(/journal|audit|activité/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
