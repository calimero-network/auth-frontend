import { defineConfig } from '@playwright/test';

// Serves the PRODUCTION build (vite preview over build/) — run
// `npm run build` first. The spec talks to a live merod via NODE_URL
// (see e2e/live-login.spec.ts for the node's required setup).
export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  timeout: 60_000,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
