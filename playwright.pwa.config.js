import { defineConfig, devices } from '@playwright/test'

const origin = 'http://127.0.0.1:4173'
const base = '/myWorkoutApp/'

export default defineConfig({
  testDir: 'tests/pwa',
  outputDir: 'test-results/pwa',
  use: {
    baseURL: new URL(base, origin).href,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'Android Chromium', use: { ...devices['Galaxy S9+'], defaultBrowserType: 'chromium' } },
    { name: 'iPhone WebKit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: new URL(base, origin).href,
    env: { VITE_BASE_PATH: base },
  },
})
