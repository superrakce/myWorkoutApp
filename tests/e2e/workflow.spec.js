import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
test('mobile bilingual workflow: filter, plan, play, records, food and backup', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('form-locale', 'en'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  await page.goto('/#/exercises')
  await page
    .getByRole('textbox', { name: 'Search exercises in English or Chinese' })
    .fill('伏地挺身')
  await expect(page.getByText('3 exercises', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add to plan', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
  await page.goto('/#/plans')
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await page.getByLabel('Sets', { exact: true }).fill('1')
  for (const label of [
    'Preparation',
    'Between sets',
    'Between exercises',
    'Between rounds',
    'Cooldown',
  ])
    await page.getByLabel(label + ' (Seconds)', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Start training', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start training', exact: true }).click()
  await page.getByRole('button', { name: 'Complete this set', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Session summary', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Activity', exact: true }).first()).toBeVisible()
  await expect(page.getByText('My training plan', { exact: true })).toBeVisible()
  await page.goto('/#/nutrition')
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Test meal')
  await dialog.getByLabel('Calories', { exact: true }).fill('150')
  await dialog.getByLabel('Grams', { exact: true }).fill('80')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Test meal', { exact: true })).toBeVisible()
  await expect(page.getByText('120 kcal', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '繁中', exact: true }).click()
  await expect(page.getByRole('heading', { name: '飲食', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Test meal', { exact: true })).toBeVisible()
  await page.goto('/#/settings')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '匯出完整備份', exact: true }).click()
  const exported = await downloaded
  expect(exported.suggestedFilename()).toContain('form-backup')
  const backup = JSON.parse(await readFile(await exported.path(), 'utf8'))
  expect(backup.data.sessions).toHaveLength(1)
  expect(backup.data.meals[0].kcal).toBe(120)
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    })
  const restoreDialog = page.getByRole('dialog')
  await expect(
    restoreDialog.getByRole('button', { name: '以備份取代本機資料', exact: true }),
  ).toBeDisabled()
  const currentBackup = page.waitForEvent('download')
  await restoreDialog.getByRole('button', { name: '匯出完整備份', exact: true }).click()
  await currentBackup
  await restoreDialog.getByRole('button', { name: '以備份取代本機資料', exact: true }).click()
  await expect(restoreDialog).not.toBeVisible()
  await page.reload()
  await page.goto('/#/nutrition')
  await expect(page.getByText('Test meal', { exact: true })).toBeVisible()
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of [
      '/',
      '/exercises',
      '/plans',
      '/history',
      '/nutrition',
      '/body',
      '/settings',
    ]) {
      await page.goto('/#' + route)
      await page.waitForTimeout(80)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        route + ' at ' + width,
      ).toBe(true)
    }
  }
})

test('body measurement and original-layout review', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('form-locale', 'en'))
  await page.reload()
  await page.goto('/#/body')
  await page.getByLabel('Age at reference date', { exact: true }).fill('30')
  await page
    .getByRole('combobox', { name: 'Formula sex parameter', exact: true })
    .selectOption('male')
  await page.getByLabel('Height (cm)', { exact: true }).fill('175')
  await page.getByLabel('Body weight (kg)', { exact: true }).fill('70')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await page.reload()
  await expect(
    page
      .locator('.metric-card')
      .filter({ hasText: 'Estimated resting energy' })
      .locator('.metric-number'),
  ).toContainText('1,649')
  await page.goto('/')
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'test-results/screenshots/desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '繁中', exact: true }).click()
  await page.screenshot({ path: 'test-results/screenshots/mobile.png', fullPage: true })
  expect(errors).toEqual([])
})
test('pause checkpoint, skip, abort and reload do not duplicate sessions', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('form-locale', 'en'))
  await page.reload()
  await page.goto('/#/player?plan=tabata')
  await page.getByRole('button', { name: 'Start training', exact: true }).click()
  await page.getByRole('button', { name: 'Skip this set', exact: true }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.reload()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.getByRole('button', { name: 'End workout', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Confirmed complete' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await page.reload()
  await expect(page.getByText('4-minute intervals', { exact: true })).toHaveCount(1)
})
