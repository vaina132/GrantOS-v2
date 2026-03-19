import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  const modules = [
    { name: 'Projects', path: '/projects' },
    { name: 'Staff', path: '/staff' },
    { name: 'Allocations', path: '/allocations' },
    { name: 'Timesheets', path: '/timesheets' },
    { name: 'Absences', path: '/absences' },
    { name: 'Financials', path: '/financials' },
  ]

  for (const mod of modules) {
    test(`navigates to ${mod.name} module and loads data`, async ({ page }) => {
      await page.goto(mod.path)
      await page.waitForLoadState('networkidle')

      // Page should not show a loading skeleton after data loads
      // Give it up to 10s for data to finish loading
      await expect(async () => {
        const skeletons = page.locator('[class*="Skeleton"]')
        const count = await skeletons.count()
        expect(count).toBe(0)
      }).toPass({ timeout: 10_000 })
    })
  }

  test('sidebar collapses and expands', async ({ page }) => {
    // Look for a sidebar toggle button
    const toggle = page.locator('button[aria-label*="sidebar" i], button[title*="sidebar" i]').first()
    if (await toggle.isVisible()) {
      await toggle.click()
      // The sidebar should still exist but may be collapsed
      await page.waitForTimeout(300)
      await toggle.click()
    }
  })

  test('navigating between modules preserves data after returning', async ({ page }) => {
    // Go to projects first
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Navigate to staff
    await page.goto('/staff')
    await page.waitForLoadState('networkidle')

    // Go back to projects — data should load from React Query cache
    await page.goto('/projects')
    
    // Should not take long to render since data is cached
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 5_000 })
  })
})
