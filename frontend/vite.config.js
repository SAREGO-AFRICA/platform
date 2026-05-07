import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Copy index.html to 404.html after build, so Vercel SPA routing works
function spa404Fallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const indexPath = resolve(dist, 'index.html');
      const fallbackPath = resolve(dist, '404.html');
      if (existsSync(indexPath)) {
        copyFileSync(indexPath, fallbackPath);
        console.log('Created 404.html as SPA fallback');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), spa404Fallback()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
