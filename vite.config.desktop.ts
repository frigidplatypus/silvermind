import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'desktop-html',
      transformIndexHtml(html) {
        return html
          .replace(/ crossorigin/g, '')
          .replace(/type="module"/g, 'defer');
      },
    },
  ],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
    },
    conditions: ['browser', 'module', 'import'],
  },
  build: {
    target: 'es2015',
    outDir: 'desktop/frontend/dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        format: 'iife',
      },
      external: [
        '@capacitor/core',
        '@capacitor/haptics',
        '@capacitor/status-bar',
        '@capacitor/splash-screen',
        '@capacitor/preferences',
        '@capacitor/local-notifications',
        '@capacitor/browser',
        '@capacitor/filesystem',
      ],
    },
  },
});
