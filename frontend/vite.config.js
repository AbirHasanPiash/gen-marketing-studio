import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the backend in dev so cookies/CORS stay simple.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/media': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    // Routes are lazy-loaded (see App.jsx); these keep the shared libraries in
    // their own long-lived files so a page change doesn't re-download React and
    // a deploy doesn't invalidate vendor code that never changed.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          query: ['@tanstack/react-query', 'axios', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
