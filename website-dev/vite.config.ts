import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    fs: { strict: true }
  }
});
