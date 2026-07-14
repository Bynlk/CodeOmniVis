import { expect, test } from '@playwright/test'
import { startWorkbenchServer, type WorkbenchServer } from './helpers/server'

let server: WorkbenchServer

test.beforeAll(async () => {
  server = await startWorkbenchServer()
})

test.afterAll(async () => {
  await server?.stop()
})

test('navigates the workbench and degrades on a graph API failure', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(server.url)
  await expect(page).toHaveTitle('CodeOmniVis - Architecture Visualizer')
  await expect(page.getByTestId('workbench')).toBeVisible()
  await expect(page.getByTestId('graph-canvas')).toBeVisible()
  await expect(page.getByText('47 nodes', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Full graph', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Full graph', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('search-input').fill('BookingList')
  await expect(page.getByRole('button', { name: 'BookingList', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'BookingList', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'BookingList', exact: true })).toBeVisible()

  await page.getByTestId('view-quality').click()
  await expect(page.getByRole('heading', { name: '13 findings', exact: true })).toBeVisible()

  await page.unroute('**/api/graph')
  await page.route('**/api/graph', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'E2E_FAILURE', message: 'forced graph failure' } }),
  }))
  await page.reload()
  await expect(page.getByTestId('canvas-error')).toContainText('Unable to load the architecture graph')
  const unexpectedConsoleErrors = consoleErrors.filter(message => (
    !message.includes('503 (Service Unavailable)')
  ))
  expect(pageErrors, `${pageErrors.join('\n')}\n${server.logs()}`).toEqual([])
  expect(unexpectedConsoleErrors, `${consoleErrors.join('\n')}\n${server.logs()}`).toEqual([])
})
