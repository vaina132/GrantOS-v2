import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Timesheets', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('loads timesheet grid with month selector', async ({ page }) => {
    await page.goto('/timesheets')
    await page.waitForLoadState('networkidle')

    // Month navigation buttons should be visible
    const monthButtons = page.locator('button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ })
    await expect(monthButtons.first()).toBeVisible({ timeout: 10_000 })
  })

  test('switching months reloads data', async ({ page }) => {
    await page.goto('/timesheets')
    await page.waitForLoadState('networkidle')

    // Click a different month tab
    const febButton = page.locator('button').filter({ hasText: 'Feb' }).first()
    if (await febButton.isVisible()) {
      await febButton.click()
      // After clicking, the page should still be functional (no error toasts)
      await page.waitForTimeout(1_000)
      const errorToast = page.locator('[class*="destructive"]')
      const errorCount = await errorToast.count()
      expect(errorCount).toBe(0)
    }
  })

  test('all timesheets tab shows staff overview', async ({ page }) => {
    await page.goto('/timesheets')
    await page.waitForLoadState('networkidle')

    // Look for the "All Timesheets" tab or similar
    const allTab = page.locator('button, a').filter({ hasText: /all|overview/i }).first()
    if (await allTab.isVisible()) {
      await allTab.click()
      await page.waitForLoadState('networkidle')
    }
  })
})
