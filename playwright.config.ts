import { defineConfig } from '@playwright/test'

const projects = [
  { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 } },
  { name: 'desktop-1920x1080', viewport: { width: 1920, height: 1080 } },
  { name: 'mobile-390x844', viewport: { width: 390, height: 844 } },
  { name: 'mobile-360x800', viewport: { width: 360, height: 800 } },
]

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: projects.map((project) => ({
    name: project.name,
    use: { viewport: project.viewport },
  })),
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
