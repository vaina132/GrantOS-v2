import { type Page } from '@playwright/test'

/**
 * Log in to the app using email/password.
 * Expects E2E_USER_EMAIL and E2E_USER_PASSWORD env vars.
 */
export async function login(page: Page) {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_USER_EMAIL and E2E_USER_PASSWORD env vars must be set')
  }

  await page.goto('/login')
  await page.getByPlaceholder(/email/i).fill(email)
  await page.getByPlaceholder(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Wait for the dashboard to load — the main indicator that auth succeeded
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

/**
 * Save authenticated state to a file for reuse across tests.
 */
export async function saveAuthState(page: Page, path: string) {
  await page.context().storageState({ path })
}
