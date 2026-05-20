import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      // Playwright specs — they call `test.describe` from `@playwright/test`,
      // and vitest can't load them. The old pattern (`**/tests/**`) didn't
      // match because the specs live under `e2e/`, not `tests/`.
      '**/e2e/**',
    ],
    server: {
      deps: {
        inline: [
          '@calimero-network/mero-js',
          '@calimero-network/mero-ui',
          '@calimero-network/mero-icons',
          '@calimero-network/mero-tokens',
          'styled-components',
        ],
      },
    },
  },
});
