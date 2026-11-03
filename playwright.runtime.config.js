import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const environment = JSON.parse(readFileSync(path.join(process.env.COURSE_QA_DIRECTORY, 'environment.json'), 'utf8'));
export default defineConfig({
  testDir: './tests/runtime', workers: 1, fullyParallel: false, timeout: 120000,
  expect: { timeout: 15000 }, retries: 0,
  outputDir: 'test-results/runtime-browser',
  reporter: [['list'], ['json', { outputFile: 'test-results/runtime-report.json' }]],
  use: { actionTimeout: 15000, baseURL: 'http://127.0.0.1:5189', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'off' },
  webServer: {
    command: 'npm run dev:free -- --host 127.0.0.1 --port 5189 --strictPort', url: 'http://127.0.0.1:5189', reuseExistingServer: false,
    env: { VITE_API_BASE_URL: environment.backendUrl },
  },
});
