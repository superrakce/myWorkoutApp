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
  const firstExercise = page.locator('.exercise-card').first()
  expect((await firstExercise.boundingBox()).height).toBeLessThan(165)
  await page.getByRole('button', { name: 'Add to plan', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
  await page.goto('/#/plans')
  const firstPlan = page.locator('.plan-card').first()
  await expect(firstPlan).toBeVisible()
  expect((await firstPlan.boundingBox()).height).toBeLessThan(165)
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await expect(page.getByRole('combobox', { name: 'Playback order', exact: true }).first()).toHaveValue('circuit')
  await expect(page.getByRole('option', { name: 'Straight sets' })).toHaveCount(0)
  await page.getByLabel('Sets', { exact: true }).fill('1')
  for (const label of [
    'Preparation',
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
  const metrics = page.locator('.history-metrics')
  await expect(metrics.getByRole('article')).toHaveCount(4)
  const columns = () => metrics.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
  expect(await columns()).toBe(2)
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await columns()).toBe(4)
  await page.setViewportSize({ width: 390, height: 844 })
  const record = page.locator('.history-row').filter({ hasText: 'My training plan' })
  await expect(record.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
  await record.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Actual reps / seconds', { exact: true }).fill('9')
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(record).toBeVisible()
  await page.goto('/#/nutrition')
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Test meal')
  await dialog.getByLabel('Calories', { exact: true }).fill('150')
  await dialog.getByLabel('Grams', { exact: true }).fill('80')
  await dialog.getByLabel('Carbs (g)', { exact: true }).fill('50')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Test meal', { exact: true })).toBeVisible()
  await expect(page.getByRole('article').filter({ hasText: 'Test meal' }).getByText('120 kcal', { exact: true })).toBeVisible()
  const mealGrid = page.locator('.meal-grid')
  await expect(mealGrid.getByRole('heading', { level: 3 })).toHaveText(['Breakfast', 'Lunch', 'Dinner', 'Snack'])
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await mealGrid.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)).toBe(4)
  const nutritionMetrics = page.locator('.nutrition-metrics')
  await expect(nutritionMetrics.getByRole('article')).toHaveCount(4)
  expect(await nutritionMetrics.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)).toBe(4)
  await expect(nutritionMetrics.getByRole('article').filter({ hasText: 'Carbs (g)' })).toContainText(/40\s*g/)
  await page.setViewportSize({ width: 390, height: 844 })
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
  expect(backup.data.sessions[0].logs[0].actual).toBe(9)
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
      await expect(page.locator('main .page-heading h1')).toBeVisible()
      await expect(page.locator('main .page-heading p')).toHaveCount(0)
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
  await page.getByLabel('Age on measurement date', { exact: true }).fill('30')
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
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.goto('/#/plans')
  const tabata = page.locator('.plan-card').filter({ hasText: '4-minute intervals' })
  await tabata.getByRole('button', { name: 'Use template' }).click()
  await expect(page.getByRole('heading', { name: 'Estimated workout calories' })).toBeVisible()
  await page.getByLabel('Estimated intensity (MET)', { exact: true }).fill('6')
  await expect(page.locator('.plan-energy .metric-number')).toHaveText(/20\s*kcal/)
  expect(errors).toEqual([])
})
test('pause checkpoint, skip, abort and reload do not duplicate sessions', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('form-locale', 'en'))
  await page.reload()
  await page.clock.install()
  await page.goto('/#/player?plan=tabata')
  await expect(page.getByText('Get ready', { exact: true })).toBeVisible()
  await page.clock.runFor(5100)
  await page.getByRole('button', { name: 'Skip this set', exact: true }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.reload()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await expect(page.getByText('A saved workout is paused. Resume when ready.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.getByRole('button', { name: 'End workout', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Confirmed complete' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await page.reload()
  await expect(page.getByText('4-minute intervals', { exact: true })).toHaveCount(1)
})


test('a custom Tabata starts from the plan card, rings at each phase, and can be discarded', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('form-locale', 'en')
    window.bellStarts = []
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (time) {
      start.call(this, time)
      window.bellStarts.push(time)
    }
  })
  const expectStrikes = async (count) => {
    await expect.poll(() => page.evaluate(() => new Set(window.bellStarts).size)).toBe(count)
    await page.evaluate(() => (window.bellStarts = []))
  }
  await page.clock.install()
  await page.goto('/#/plans')
  await page.getByRole('button', { name: 'Create a plan', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Quick Tabata')
  await page.getByRole('combobox', { name: 'Playback order', exact: true }).selectOption('tabata')
  await expect(page.getByLabel('Rounds', { exact: true })).toHaveValue('8')
  await page.getByLabel('Rounds', { exact: true }).fill('2')
  await page.getByLabel('Preparation (Seconds)', { exact: true }).fill('1')
  await page.getByLabel('Interval rest (Seconds)', { exact: true }).fill('1')
  await page.getByLabel('Cooldown (Seconds)', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search exercises in English or Chinese' }).fill('Bodyweight squat')
  await page.getByRole('button', { name: 'Add to plan', exact: true }).click()
  const exerciseDialog = page.getByRole('dialog')
  expect(await exerciseDialog.getByRole('option', { name: 'Quick Tabata', exact: true }).evaluate((option) => option.selected)).toBe(true)
  await exerciseDialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Work time (Seconds)', { exact: true })).toHaveValue('20')
  await expect(page.getByRole('combobox', { name: 'Playback order', exact: true })).toHaveCount(1)
  await page.getByLabel('Work time (Seconds)', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const card = page.getByRole('article').filter({ hasText: 'Quick Tabata' })
  await card.getByRole('button', { name: 'Start Tabata', exact: true }).click()
  await expect(page.getByText('Get ready', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start training', exact: true })).toHaveCount(0)
  await expectStrikes(0)
  for (const [duration, label, strikes] of [
    [1100, 'Time to move', 2],
    [1100, 'Take a breath', 3],
    [1100, 'Time to move', 2],
    [1100, 'Ease into your cooldown', 2],
  ]) {
    await page.clock.runFor(duration)
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    await expectStrikes(strikes)
  }
  await page.clock.runFor(1100)
  await expect(page.getByRole('heading', { name: 'Session summary', exact: true })).toBeVisible()
  await expectStrikes(3)
  await expect(page.getByRole('checkbox', { name: 'Confirmed complete' })).toHaveCount(2)
  await page.getByRole('button', { name: 'Leave without saving', exact: true }).click()
  await expect(page).toHaveURL(/#\/plans$/)
  await page.goto('/#/settings')
  await page.reload()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export full backup', exact: true }).click()
  const backup = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'))
  expect(backup.data.sessions).toEqual([])
  expect(backup.data.active).toBeNull()
})


test('Tabata plays one distinct key tone at 3, 2 and 1 for timed work and rest', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('form-locale', 'en')
    window.countdownNotes = []
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (time) {
      start.call(this, time)
      if ([520, 620, 740, 1120, 980, 840].includes(this.frequency.value)) {
        window.countdownNotes.push([this.frequency.value, this.type])
      }
    }
  })
  const notes = () => page.evaluate(() => window.countdownNotes)
  const time = new Date('2026-01-01T10:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1000))
  await page.goto('/#/plans')
  const tabata = page.getByRole('article').filter({ hasText: '4-minute intervals' })
  await tabata.getByRole('button', { name: 'Start Tabata', exact: true }).click()
  await expect(page.getByText('Get ready', { exact: true })).toBeVisible()

  await page.clock.runFor(21800)
  await expect(page.locator('.timer')).toHaveText(/^4\s*Seconds$/)
  expect(await notes()).toEqual([])
  await page.clock.runFor(500)
  await expect(page.locator('.timer')).toHaveText(/^3\s*Seconds$/)
  const work = [[520, 'triangle']]
  await expect.poll(notes).toEqual(work)

  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.clock.runFor(2000)
  expect(await notes()).toEqual(work)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  for (const [second, frequency] of [[2, 620], [1, 740]]) {
    await page.clock.runFor(1000)
    work.push([frequency, 'triangle'])
    await expect(page.locator('.timer')).toHaveText(new RegExp('^' + second + '\\s*Seconds$'))
    await expect.poll(notes).toEqual(work)
  }

  await page.clock.runFor(7500)
  await expect(page.getByText('Take a breath', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.timer')).toHaveText(/^4\s*Seconds$/)
  expect(await notes()).toEqual(work)
  const allNotes = [...work]
  for (const [elapsed, second, frequency] of [[600, 3, 1120], [1000, 2, 980], [1000, 1, 840]]) {
    await page.clock.runFor(elapsed)
    allNotes.push([frequency, 'sine'])
    await expect(page.locator('.timer')).toHaveText(new RegExp('^' + second + '\\s*Seconds$'))
    await expect.poll(notes).toEqual(allNotes)
  }
  await page.clock.runFor(1200)
  await expect(page.getByText('Time to move', { exact: true })).toBeVisible()
  expect(await notes()).toEqual(allNotes)
})

test('the player can preview and mute the bell before starting', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('form-locale', 'en')
    window.previewStarts = 0
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (time) {
      start.call(this, time)
      window.previewStarts++
    }
  })
  await page.goto('/#/player')
  const preview = page.getByRole('button', { name: 'Preview bell' })
  const volume = page.getByRole('slider', { name: 'Bell volume' })
  await volume.press('Home')
  await expect(preview).toBeDisabled()
  await expect(volume).toHaveValue('0')
  await volume.press('End')
  await preview.click()
  await expect.poll(() => page.evaluate(() => window.previewStarts)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Start training', exact: true })).toBeVisible()
})

test('overview quick actions open their forms and metrics sit beside the radar', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('form-locale', 'en'))
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.goto('/')
  const actions = page.locator('.dashboard-actions')
  await expect(actions.getByRole('link')).toHaveCount(3)
  await expect(actions.getByRole('button', { name: 'Start training', exact: true })).toBeVisible()
  await expect(page.locator('.dashboard-metrics .metric-card')).toHaveCount(4)
  const metrics = await page.locator('.dashboard-metrics').boundingBox()
  const radar = await page.locator('.dashboard-columns > .panel').boundingBox()
  expect(metrics.x + metrics.width).toBeLessThan(radar.x)
  await expect(page.getByText('Build your own rhythm', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toHaveCount(0)
  await expect(page.locator('.sidebar').getByRole('link', { name: 'Activity', exact: true })).toBeVisible()
  await expect(page.getByText('Your next session', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Small steps, daily', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Training, in balance.', { exact: true })).toHaveCount(0)
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(23, 44, 54)')
  expect(await page.locator('.dashboard-metrics .metric-card').first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(32, 57, 70)')
  expect(await page.locator('.accent').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(243, 227, 8)')
  expect(await actions.getByRole('link', { name: 'Create a plan', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(44, 76, 92)')

  await actions.getByRole('link', { name: 'Log a meal', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Log a meal', exact: true })).toBeVisible()
  await page.goto('/')
  await actions.getByRole('link', { name: 'Add a measurement', exact: true }).click()
  await expect(page.locator('#measurement-form h2')).toBeInViewport()

  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await expect(actions.getByRole('button', { name: 'Start training' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await actions.getByRole('link', { name: 'Create a plan', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My training plan')
})
