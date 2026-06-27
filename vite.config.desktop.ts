import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
    },
    conditions: ['browser', 'module', 'import'],
  },
  build: {
    outDir: 'desktop/frontend/dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        '@capacitor/core',
        '@capacitor/haptics',
        '@capacitor/status-bar',
        '@capacitor/splash-screen',
        '@capacitor/preferences',
        '@capacitor/local-notifications',
        '@capacitor/browser',
      ],
    },
  },
  optimizeDeps: {
    exclude: [
      '@capacitor/core',
      '@capacitor/haptics',
      '@capacitor/status-bar',
      '@capacitor/splash-screen',
      '@capacitor/preferences',
      '@capacitor/local-notifications',
      '@capacitor/browser',
    ],
  },
});
