import { defineConfig } from 'vite';

/**
 * Slidev supplies its own Vite config; this file is merged into it.
 * The only thing the deck needs is to stop Vite pre-bundling the workspace
 * packages, which ship TypeScript and `.vue` sources rather than a build.
 */
export default defineConfig({
  optimizeDeps: {
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
});
