import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 20000
  },
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure'
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 }
  }
});
