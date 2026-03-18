import { test, expect } from '@playwright/test'
import { asRetailer } from './fixtures/auth'

test.describe('Compare and book', () => {
  test.beforeEach(async ({ page }) => {
    await asRetailer(page)
  })

  test('retailer compares carriers and books a shipment', async ({ page }) => {
    await page.goto('/compare')

    // Fill compare form — use city names that exist in city-zones.json
    await page.getByLabel(/origine/i).fill('Casablanca')
    await page.getByLabel(/destination/i).fill('Rabat')
    await page.getByLabel(/poids/i).fill('2000')
    await page.getByLabel(/valeur cod/i).fill('500')
    await page.getByRole('button', { name: /comparer/i }).click()

    // Results should render
    await expect(page.getByTestId('carrier-results')).toBeVisible({ timeout: 10_000 })
    const cards = page.getByTestId('carrier-result-card')
    await expect(cards.first()).toBeVisible()

    // Open booking sheet on Aramex (only carrier with a working mock API in dev)
    const aramexCard = cards.filter({ hasText: 'Aramex' })
    await expect(aramexCard).toBeVisible()
    await aramexCard.getByRole('button', { name: /réserver/i }).click()

    // Booking form inside sheet
    await page.getByLabel(/nom du destinataire/i).fill('Ahmed Benali')
    await page.getByLabel(/^téléphone$/i).fill('+212699887766')
    await page.getByLabel(/adresse complète/i).fill('45 Avenue Mohammed V, Rabat')
    await page.getByRole('button', { name: /confirmer la réservation/i }).click()

    // Success toast
    await expect(page.getByText(/réservation confirmée/i)).toBeVisible({ timeout: 15_000 })
  })
})
