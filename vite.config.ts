import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: process.env.WINEMAKER_AUTHORITY_ORIGIN || 'http://127.0.0.1:3002', rewrite: (path) => path.replace(/^\/api/, '') } } },
});
