import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/auth/',
  build: {
    // Generate a single HTML file with inlined assets where possible
    outDir: 'build',
    assetsInlineLimit: 100000, // 100kb
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
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
  },
  resolve: {
    alias: {
      buffer: 'buffer'
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
  }
});
