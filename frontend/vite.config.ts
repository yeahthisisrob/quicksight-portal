import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

// Vite 8 bundles with Rolldown rather than Rollup. Two consequences below:
// `manualChunks` must be a function (the object form is gone), and
// `maxParallelFileOps` no longer exists - Rolldown schedules its own IO.

/** Vendor chunks, in priority order: first match wins. */
const VENDOR_CHUNKS: Array<[chunk: string, packages: string[]]> = [
  ['mui', ['@mui/material', '@mui/icons-material', '@mui/x-data-grid', '@mui/x-date-pickers']],
  ['monaco', ['@monaco-editor/react', 'monaco-editor']],
  ['query', ['@tanstack/react-query']],
  ['router', ['react-router-dom', 'react-router']],
  ['vendor', ['react-dom', 'react']],
];

export default defineConfig({
  plugins: [react(), checker({ typescript: true })],
  resolve: {
    alias: {
      // import.meta.dirname, not __dirname: Vite 8's native config loader does
      // not provide CommonJS globals.
      '@': new URL('./src', import.meta.url).pathname,
      '@shared': new URL('../shared', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy API calls to SAM local
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          for (const [chunk, packages] of VENDOR_CHUNKS) {
            if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
              return chunk;
            }
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
