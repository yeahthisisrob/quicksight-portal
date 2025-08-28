import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: true,
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
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
    }
  },
  build: {
    rollupOptions: {
      maxParallelFileOps: 100,
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@mui/x-data-grid', '@mui/x-date-pickers'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          monaco: ['@monaco-editor/react'],
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});