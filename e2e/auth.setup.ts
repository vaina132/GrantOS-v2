import { test as setup } from '@playwright/test'
import { login, saveAuthState } from './helpers/auth'

const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Global setup: log in once and save the session for all other tests.
 * Run with: npx playwright test --project=setup
 */
setup('authenticate', async ({ page }) => {
  await login(page)
  await saveAuthState(page, AUTH_FILE)
})
