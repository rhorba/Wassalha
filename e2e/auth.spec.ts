import { test, expect } from '@playwright/test'

// With real keys the handshake completes and the URL briefly holds ?__clerk_handshake=<jwt>
// before the final /sign-in redirect. Accept all three URL states.
const CLERK_REDIRECT = /sign-in|clerk\.accounts\.dev|__clerk_handshake/

test.describe('Auth redirects', () => {
  test('unauthenticated user visiting /dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(CLERK_REDIRECT, { timeout: 20_000 })
  })

  test('unauthenticated user visiting /compare redirects to sign-in', async ({ page }) => {
    await page.goto('/compare')
    await expect(page).toHaveURL(CLERK_REDIRECT, { timeout: 20_000 })
  })

  test('unauthenticated user visiting /admin/carriers redirects', async ({ page }) => {
    await page.goto('/admin/carriers')
    await page.waitForURL(/sign-in|dashboard|clerk\.accounts\.dev|__clerk_handshake/, { timeout: 20_000 }).catch(() => {})
    expect(page.url()).toMatch(/sign-in|dashboard|clerk\.accounts\.dev|__clerk_handshake/)
  })
})
