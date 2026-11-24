import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served under /admin/ behind nginx. In development the API is proxied so cookies stay same-origin.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    host: true,
    port: 3001,
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:4200', changeOrigin: false },
      '/uploads': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:4200', changeOrigin: false },
    },
    watch: process.env.CHOKIDAR_USEPOLLING ? { usePolling: true, interval: 500 } : undefined,
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
