import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [svelte()],
  root,
  base: '/',
  resolve: {
    alias: {
      $lib: path.resolve(root, 'src/lib'),
    },
    conditions: ['browser', 'module', 'import'],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      external: [
        '@capacitor/core',
        '@capacitor/haptics',
        '@capacitor/status-bar',
        '@capacitor/splash-screen',
        '@capacitor/preferences',
      ],
    },
  },
});
