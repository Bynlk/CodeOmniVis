import { expect, test } from '@playwright/test'

test.describe('orders browser', () => {
  test('opens the orders page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('article')).toBeVisible()
  })
})
