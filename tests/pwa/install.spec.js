import { expect, test } from '@playwright/test'

test('the Pages build is installable and a meal survives an offline reload', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state))
    .toBe('activated')

  const manifestLink = page.locator('link[rel="manifest"]')
  const manifestUrl = new URL(await manifestLink.getAttribute('href'), page.url())
  const response = await page.request.get(manifestUrl.href)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest.display).toBe('standalone')
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe('/myWorkoutApp/')
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe('/myWorkoutApp/')

  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  const touchIconResponse = await page.request.get(new URL(touchIcon, page.url()).href)
  expect(touchIconResponse.headers()['content-type']).toContain('image/png')

  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page)
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    expect(installabilityErrors).toEqual([])
    await cdp.detach()
  }

  await context.setOffline(true)
  await page.goto('./#/nutrition')
  await page.reload()
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Offline test meal')
  await dialog.getByLabel('Calories', { exact: true }).fill('100')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await expect(page.getByText('Offline test meal', { exact: true })).toBeVisible()
})
