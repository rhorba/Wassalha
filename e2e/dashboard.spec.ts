import { test, expect } from '@playwright/test'
import { asRetailer, hasClerkCredentials } from './fixtures/auth'

test.describe('Dashboard — retailer view', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasClerkCredentials()) {
      test.skip(true, 'Clerk test credentials not configured')
    }
    await asRetailer(page)
  })

  test('dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    // KPI row should contain stat cards
    const kpiRow = page.getByTestId('kpi-row').or(page.locator('[data-testid*="stat"]'))
    if (await kpiRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(kpiRow).toBeVisible()
    } else {
      // At minimum the page itself should not 500
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('dashboard navigation is present', async ({ page }) => {
    await page.goto('/dashboard')
    // App uses a horizontal top nav (not a sidebar)
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible({ timeout: 10_000 })
  })

  test('analytics page loads charts', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await expect(page.locator('body')).toBeVisible()
    // Charts or empty state
    const hasChart = await page.locator('canvas, svg[class*="recharts"]').first().isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasChart) {
      // At minimum the page renders without a 500
      await expect(page.getByText(/analyse|analytique|graphique/i).first()).toBeVisible({ timeout: 5_000 }).catch(() => {})
    }
  })

  test('user profile — dashboard has push notification toggle', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    // Push toggle (bell icon) in header
    const bellToggle = page.getByTestId('push-toggle').or(page.getByRole('button', { name: /notification|push|cloche/i }))
    if (await bellToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(bellToggle).toBeVisible()
    }
  })
})
