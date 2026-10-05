/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Same forward as nginx.conf, so the DAZN lookup works in development too.
  server: { proxy: { '/dazn': { target: 'https://www.dazn.com', changeOrigin: true, headers: { 'User-Agent': 'StatWatch/1.0' }, rewrite: (path) => path.replace(/^\/dazn/, '') } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
