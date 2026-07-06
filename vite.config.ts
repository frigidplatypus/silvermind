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
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['p5810', 'p5810.local', '.local'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
