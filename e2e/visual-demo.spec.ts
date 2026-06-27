import { test, expect } from '@playwright/test'

/**
 * Visual demo walkthrough — records a cinematic tour of the Wassalha app.
 * Designed to produce a meaningful video with deliberate pauses and scrolling.
 * Runs against the public landing page only (no Clerk credentials required).
 */

test.describe('Wassalha Visual Demo', () => {
  test('01 — landing page full walkthrough', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Show page title in viewport
    await expect(page).toHaveTitle(/Wassalha/)
    await page.waitForTimeout(800)

    // Show navbar
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await page.waitForTimeout(600)
  })

  test('02 — hero section with Arabic tagline', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    // Arabic headline
    await expect(page.getByText('وصّلها بسهولة')).toBeVisible()
    await page.waitForTimeout(1000)

    // French subtitle
    await expect(page.getByText(/Comparez les transporteurs/i)).toBeVisible()
    await page.waitForTimeout(800)

    // CTA buttons
    await expect(page.getByRole('link', { name: /commencer gratuitement/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /se connecter/i })).toBeVisible()
    await page.waitForTimeout(1000)
  })

  test('03 — value propositions section', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Scroll to value props
    await page.getByRole('heading', { name: /Économisez sur les frais/i }).scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

    await expect(page.getByRole('heading', { name: /Économisez sur les frais/i })).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByRole('heading', { name: /Réservez en 1 clic/i })).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByRole('heading', { name: /Suivi en temps réel/i })).toBeVisible()
    await page.waitForTimeout(1000)
  })

  test('04 — how-it-works 3 steps', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByText(/Comment ça marche/i).scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

    await expect(page.getByText(/Comment ça marche/i)).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page.getByText('01')).toBeVisible()
    await page.waitForTimeout(400)
    await expect(page.getByText('02')).toBeVisible()
    await page.waitForTimeout(400)
    await expect(page.getByText('03')).toBeVisible()
    await page.waitForTimeout(800)
    await expect(page.getByRole('heading', { name: 'Comparez', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Réservez', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Suivez', exact: true })).toBeVisible()
    await page.waitForTimeout(1000)
  })

  test('05 — partner carriers strip', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByText(/Transporteurs partenaires/i).scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

    await expect(page.getByText(/Transporteurs partenaires/i)).toBeVisible()
    await page.waitForTimeout(600)

    for (const carrier of ['Amana', 'Aramex', 'CTM', 'Marocolis', 'Sendex']) {
      await expect(page.getByText(carrier)).toBeVisible()
      await page.waitForTimeout(300)
    }
    await page.waitForTimeout(800)
  })

  test('06 — FAQ accordion interactions', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByText(/Questions fréquentes/i).scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await expect(page.getByText(/Questions fréquentes/i)).toBeVisible()

    // Open Q1
    const q1 = page.getByText(/Quels transporteurs sont disponibles/i)
    await q1.scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await q1.click()
    await page.waitForTimeout(800)
    await expect(page.getByText(/Amana, Aramex, CTM, Marocolis et Sendex/i)).toBeVisible()
    await page.waitForTimeout(800)

    // Open Q2
    const q2 = page.getByText(/Comment fonctionne la commission/i)
    await q2.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await q2.click()
    await page.waitForTimeout(800)
    await expect(page.getByText(/commission est prélevée/i)).toBeVisible()
    await page.waitForTimeout(800)

    // Open Q3
    const q3 = page.getByText(/Puis-je utiliser Wassalha depuis mon téléphone/i)
    await q3.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await q3.click()
    await page.waitForTimeout(800)
    await expect(page.getByText(/interface est entièrement optimisée/i)).toBeVisible()
    await page.waitForTimeout(1000)
  })

  test('07 — CTA footer and contact', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.getByText(/Prêt à démarrer/i).scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

    await expect(page.getByText(/Prêt à démarrer/i)).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByText(/Rejoignez les commerçants marocains/i)).toBeVisible()
    await page.waitForTimeout(600)

    const ctaBtn = page.getByRole('link', { name: /commencer gratuitement/i }).last()
    await expect(ctaBtn).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByRole('link', { name: /contact@wassalha.ma/i })).toBeVisible()
    await page.waitForTimeout(800)
  })

  test('08 — mobile responsive (390×844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    await expect(page.locator('nav').getByText('Wassalha')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByText('وصّلها بسهولة')).toBeVisible()
    await page.waitForTimeout(600)

    // Scroll through the page on mobile
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.scrollTo({ top: 1000, behavior: 'smooth' }))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    await page.waitForTimeout(800)
  })

  test('09 — tablet responsive (768×1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    await expect(page.getByRole('heading', { name: /Économisez sur les frais/i })).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByRole('heading', { name: /Réservez en 1 clic/i })).toBeVisible()
    await page.waitForTimeout(600)
    await expect(page.getByRole('heading', { name: /Suivi en temps réel/i })).toBeVisible()
    await page.waitForTimeout(800)
  })

  test('10 — full page scroll top to bottom', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    // Smooth scroll through entire page
    for (let i = 1; i <= 8; i++) {
      await page.evaluate((step) => {
        window.scrollTo({ top: step * 400, behavior: 'smooth' })
      }, i)
      await page.waitForTimeout(500)
    }

    await expect(page.getByText(/Prêt à démarrer/i)).toBeVisible()
    await page.waitForTimeout(600)

    // Scroll back to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    await page.waitForTimeout(600)
    await expect(page.getByText('وصّلها بسهولة')).toBeVisible()
    await page.waitForTimeout(800)
  })

  test('11 — auth entry points navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    // Hover over Connexion link to highlight it
    const connexionLink = page.locator('nav').getByRole('link', { name: /connexion/i })
    await connexionLink.hover()
    await page.waitForTimeout(800)

    // Navigate to sign-in (Clerk handles the auth UI)
    await connexionLink.click()
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(1500)

    // Go back to landing
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    // Hover CTA
    const ctaLink = page.getByRole('link', { name: /commencer gratuitement/i }).first()
    await ctaLink.hover()
    await page.waitForTimeout(800)
    await ctaLink.click()
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(1500)
  })
})
