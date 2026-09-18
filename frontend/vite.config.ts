import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

// Vite 8 bundles with Rolldown rather than Rollup. Two consequences below:
// `manualChunks` must be a function (the object form is gone), and
// `maxParallelFileOps` no longer exists - Rolldown schedules its own IO.

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
        // Rolldown's automatic shared-chunk splitting produced a *cyclic chunk
        // graph* for this app (ui -> api -> AssetsPage -> lib -> ui) even though
        // the module graph is acyclic. A chunk then executed while one it
        // depends on was still initialising, so imported bindings read as
        // undefined and the app rendered a blank page.
        //
        // Collapsing everything that is not a lazily-loaded page into one
        // `shared` chunk removes the possibility: vendor <- shared <- pages is
        // strictly one-directional, and the page chunks are async, which cannot
        // create an initialisation cycle.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](\.pnpm[\\/])?(@mui|@emotion)/.test(id)) {
              return 'mui';
            }
            if (/[\\/]node_modules[\\/](\.pnpm[\\/])?(react|react-dom|scheduler)[@\\/]/.test(id)) {
              return 'react';
            }
            return 'vendor';
          }
          // Pages are React.lazy targets; leave them as their own async chunks.
          if (/[\\/]src[\\/]pages[\\/]/.test(id)) {
            return undefined;
          }
          return id.includes('/src/') ? 'shared' : undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
