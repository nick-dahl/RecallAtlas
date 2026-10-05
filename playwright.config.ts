import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

loadEnvConfig(process.cwd());

/** Set E2E_BASE_URL (e.g. the Vercel URL) to test a deployment instead of the local dev server. */
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { baseURL: remote ?? 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remote
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
});
