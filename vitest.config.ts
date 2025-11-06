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
      '**/tests/**', // Exclude Playwright tests
    ],
    server: {
      deps: {
        inline: [
          '@calimero-network/calimero-client',
          '@calimero-network/mero-ui',
          '@calimero-network/mero-icons',
          '@calimero-network/mero-tokens',
          'styled-components',
        ],
      },
    },
  },
});
