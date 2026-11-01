import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5188',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:free -- --host 127.0.0.1 --port 5188 --strictPort',
    url: 'http://127.0.0.1:5188',
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:5188/api/v1' },
    reuseExistingServer: false,
  },
});
