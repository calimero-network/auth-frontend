import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'VITE_ENABLE_MSW=false pnpm run dev --port 5174',
    url: 'http://localhost:5174/auth/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  timeout: 30_000,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
