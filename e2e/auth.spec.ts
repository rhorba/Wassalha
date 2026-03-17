import { test, expect } from '@playwright/test'

test.describe('Auth redirects', () => {
  test('unauthenticated user visiting /dashboard redirects to /sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('unauthenticated user visiting /compare redirects to /sign-in', async ({ page }) => {
    await page.goto('/compare')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('unauthenticated user visiting /admin/carriers redirects to /sign-in', async ({ page }) => {
    await page.goto('/admin/carriers')
    await expect(page).toHaveURL(/sign-in/)
  })
})
