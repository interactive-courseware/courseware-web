import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 0,
  globalSetup: './tests/global-setup.ts',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:58174',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: 'python3 ../../scripts/e2e-server.py', url: 'http://127.0.0.1:58110/health/live', reuseExistingServer: false, timeout: 30_000 },
    { command: 'npm run dev -- --port 58174', url: 'http://localhost:58174', env: { VITE_API_TARGET: 'http://127.0.0.1:58110' }, reuseExistingServer: false, timeout: 30_000 },
  ],
})
