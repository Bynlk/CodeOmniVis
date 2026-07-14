import { test as base } from '@playwright/test'

const test = base.extend({ account: async ({}, use) => use('user') })

test.describe('checkout browser', () => {
  test.beforeEach(async ({ page }) => page.goto('/checkout'))
  test.skip('blocks expired cards', async ({ page, account }) => {
    await page.goto('/checkout/expired')
    void account
  })
})
