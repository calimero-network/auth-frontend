import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set CALIMERO_NODE_URL when running `pnpm dev` to point the proxy at
// your local merod (defaults to 2428). Falls back to localhost:2428.
const NODE_URL = process.env.CALIMERO_NODE_URL ?? 'http://localhost:2428';

export default defineConfig({
  plugins: [react()],
  base: '/auth/',
  build: {
    outDir: 'build',
    assetsInlineLimit: 100000, // 100kb — inline most assets into a single HTML
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: { buffer: 'buffer' },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    // Proxy auth/admin endpoints to merod so localhost:5173 looks
    // same-origin to the dev build. Without this, /auth/token hits the
    // vite dev server (404 → "invalid credentials" surfaces from the
    // mero-js HTTP client).
    proxy: {
      '/auth': { target: NODE_URL, changeOrigin: true },
      '/admin': { target: NODE_URL, changeOrigin: true },
      '/admin-api': { target: NODE_URL, changeOrigin: true },
      '/jsonrpc': { target: NODE_URL, changeOrigin: true },
    },
  },
});
