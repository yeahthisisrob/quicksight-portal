import path from 'node:path';

import react from '@vitejs/plugin-react';
// From vitest/config, not vite: since Vite 8 the `test` key is not part of
// Vite's own config type, so `defineConfig` imported from 'vite' rejects it.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, '../shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
