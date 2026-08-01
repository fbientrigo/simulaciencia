import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@simulaciencia/schemas': here('./packages/schemas/src/index.ts'),
      '@simulaciencia/core': here('./packages/core/src/index.ts'),
      '@simulaciencia/theme': here('./packages/theme/src/index.ts'),
      '@simulaciencia/visuals': here('./packages/visuals/src/index.ts'),
      '@simulaciencia/case-inverse-transform': here('./cases/inverse-transform/src/index.ts'),
      '@simulaciencia/case-poisson-counting': here('./cases/poisson-counting/src/index.ts'),
      '@simulaciencia/case-radioactive-decay': here('./cases/radioactive-decay/src/index.ts'),
    },
  },
  test: {
    // jsdom everywhere keeps one runner; the engine tests never touch the DOM
    // and a forbidden-import test proves they cannot start to.
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
  },
});
