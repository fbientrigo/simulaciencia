import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [vue()],
  optimizeDeps: {
    // Workspace packages ship TypeScript sources rather than a build artifact.
    // Excluding them keeps Vite compiling them through the normal pipeline
    // instead of trying to pre-bundle raw .ts and .vue files.
    exclude: [
      '@simulaciencia/core',
      '@simulaciencia/schemas',
      '@simulaciencia/theme',
      '@simulaciencia/visuals',
      '@simulaciencia/case-inverse-transform',
      '@simulaciencia/case-poisson-counting',
      '@simulaciencia/case-radioactive-decay',
    ],
  },
  build: {
    target: 'es2022',
    // Three.js dominates the bundle; a warning at 500 kB is just noise here.
    chunkSizeWarningLimit: 900,
  },
});
