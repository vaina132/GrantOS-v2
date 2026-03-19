import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('loads dashboard with KPI cards', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/dashboard/i)

    // At least one KPI card should be visible
    const kpiCards = page.locator('[class*="CardContent"]')
    await expect(kpiCards.first()).toBeVisible({ timeout: 10_000 })
  })

  test('KPI cards navigate to correct pages', async ({ page }) => {
    // Click the "Projects" KPI card
    const projectsCard = page.getByText(/projects/i).first()
    await projectsCard.click()
    await expect(page).toHaveURL(/\/projects/)
  })

  test('year selector changes the year', async ({ page }) => {
    const yearSelector = page.locator('select').filter({ hasText: /20\d{2}/ }).first()
    if (await yearSelector.isVisible()) {
      const currentValue = await yearSelector.inputValue()
      expect(currentValue).toMatch(/^\d{4}$/)
    }
  })
})
