import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const SERVER = 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    // Loopback only. Never 0.0.0.0 in dev (N9).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },
    // Same-origin in dev, so no CORS and the origin check stays meaningful.
    proxy: {
      '/api': { target: SERVER, changeOrigin: false },
      '/ws': { target: SERVER, ws: true, changeOrigin: false },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
