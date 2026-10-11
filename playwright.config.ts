import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests run against the local dev server and the local Supabase stack (`supabase start`).
 * They use the installed Chrome (channel "chrome"), so no browser download is needed.
 * Run: `pnpm exec playwright test` (the dev server is started automatically unless one is already running).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'off', channel: 'chrome' },
  projects: [
    { name: 'mobile-375', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 }, channel: 'chrome' } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 }, channel: 'chrome' } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
