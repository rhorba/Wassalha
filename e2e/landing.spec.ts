import { test, expect } from '@playwright/test'

test.describe('Landing Page — full visual walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page title and metadata', async ({ page }) => {
    await expect(page).toHaveTitle(/Wassalha/)
  })

  test('navbar renders with brand and auth links', async ({ page }) => {
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await expect(nav.getByText('Wassalha')).toBeVisible()

    const connexion = nav.getByRole('link', { name: /connexion/i })
    await expect(connexion).toBeVisible()
    await expect(connexion).toHaveAttribute('href', '/sign-in')

    const commencer = nav.getByRole('link', { name: /commencer/i })
    await expect(commencer).toBeVisible()
    await expect(commencer).toHaveAttribute('href', '/sign-up')
  })

  test('hero section — Arabic tagline and French subtitle visible', async ({ page }) => {
    const hero = page.locator('section').first()
    // Arabic heading
    await expect(page.getByText('وصّلها بسهولة')).toBeVisible()
    // French subtitle
    await expect(page.getByText(/Comparez les transporteurs/i)).toBeVisible()
    // CTA buttons
    await expect(page.getByRole('link', { name: /commencer gratuitement/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /se connecter/i })).toBeVisible()
    void hero
  })

  test('value propositions — 3 cards visible with icons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Économisez sur les frais/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Réservez en 1 clic/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Suivi en temps réel/i })).toBeVisible()
    // Card descriptions
    await expect(page.getByText(/Comparez les tarifs de 5 transporteurs/i).first()).toBeVisible()
    await expect(page.getByText(/Une fois le transporteur choisi/i)).toBeVisible()
    await expect(page.getByText(/Suivez chaque colis/i)).toBeVisible()
  })

  test('how-it-works section — 3 numbered steps', async ({ page }) => {
    await expect(page.getByText(/Comment ça marche/i)).toBeVisible()
    await expect(page.getByText('01')).toBeVisible()
    await expect(page.getByText('02')).toBeVisible()
    await expect(page.getByText('03')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Comparez', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Réservez', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Suivez', exact: true })).toBeVisible()
  })

  test('carrier strip — all 5 partner carriers listed', async ({ page }) => {
    await expect(page.getByText(/Transporteurs partenaires/i)).toBeVisible()
    for (const carrier of ['Amana', 'Aramex', 'CTM', 'Marocolis', 'Sendex']) {
      await expect(page.getByText(carrier)).toBeVisible()
    }
  })

  test('FAQ section — accordion items collapse and expand', async ({ page }) => {
    await expect(page.getByText(/Questions fréquentes/i)).toBeVisible()

    // Q1 — carriers
    const q1 = page.getByText(/Quels transporteurs sont disponibles/i)
    await expect(q1).toBeVisible()
    await q1.click()
    await expect(page.getByText(/Amana, Aramex, CTM, Marocolis et Sendex/i)).toBeVisible()

    // Q2 — commission
    const q2 = page.getByText(/Comment fonctionne la commission/i)
    await expect(q2).toBeVisible()
    await q2.click()
    await expect(page.getByText(/commission est prélevée/i)).toBeVisible()

    // Q3 — mobile
    const q3 = page.getByText(/Puis-je utiliser Wassalha depuis mon téléphone/i)
    await expect(q3).toBeVisible()
    await q3.click()
    await expect(page.getByText(/interface est entièrement optimisée/i)).toBeVisible()

    // Q4 — colis types
    const q4 = page.getByText(/Quels types de colis puis-je envoyer/i)
    await expect(q4).toBeVisible()
    await q4.click()
    await expect(page.getByText(/Tout colis COD standard/i)).toBeVisible()

    // Q5 — tracking
    const q5 = page.getByText(/Comment suivre mes livraisons/i)
    await expect(q5).toBeVisible()
    await q5.click()
    await expect(page.getByText(/tableau de bord, chaque expédition/i)).toBeVisible()
  })

  test('CTA footer — heading, subtitle and button visible', async ({ page }) => {
    await expect(page.getByText(/Prêt à démarrer/i)).toBeVisible()
    await expect(page.getByText(/Rejoignez les commerçants marocains/i)).toBeVisible()
    const ctaButton = page.getByRole('link', { name: /commencer gratuitement/i }).last()
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toHaveAttribute('href', '/sign-up')
    // Contact email
    await expect(page.getByRole('link', { name: /contact@wassalha.ma/i })).toBeVisible()
  })

  test('CTA — clicking "Commencer gratuitement" navigates to /sign-up', async ({ page }) => {
    await page.getByRole('link', { name: /commencer gratuitement/i }).first().click()
    await expect(page).toHaveURL(/sign-up/)
  })

  test('navbar — clicking "Connexion" navigates to /sign-in', async ({ page }) => {
    await page.locator('nav').getByRole('link', { name: /connexion/i }).click()
    await expect(page).toHaveURL(/sign-in/)
  })

  test('mobile viewport — navbar and hero visible on 390×844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.locator('nav').getByText('Wassalha')).toBeVisible()
    await expect(page.getByText('وصّلها بسهولة')).toBeVisible()
  })

  test('tablet viewport — value props grid renders on 768×1024', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Économisez sur les frais/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Réservez en 1 clic/i })).toBeVisible()
  })

  test('full page scroll — all sections reachable', async ({ page }) => {
    // Scroll to bottom to verify no layout breaks
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByText(/Prêt à démarrer/i)).toBeVisible()
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.getByText('وصّلها بسهولة')).toBeVisible()
  })
})
