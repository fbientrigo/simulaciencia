import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // Secondary build outputs: the demo deck and the Pages base build.
      '**/dist-*/**',
      '**/node_modules/**',
      '**/.slidev/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser and Node globals the workspace actually touches. Listing them
        // explicitly is cheaper than pulling in the `globals` package for the
        // handful of names in play.
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        globalThis: 'readonly',
        console: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        URLSearchParams: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        RenderingContext: 'readonly',
        MediaQueryList: 'readonly',
        MediaQueryListEvent: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    rules: {
      // The deck and the gallery use multi-word-safe names already; this rule
      // fights the `<Panel>` / `<CheckList>` naming the lesson markup relies on.
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/attribute-hyphenation': ['error', 'always'],
    },
  },

  /*
   * The architectural boundary, enforced at lint time as well as by
   * `tests/unit/engine-purity.test.ts`.
   */
  {
    files: ['packages/core/**/*.ts', 'packages/schemas/**/*.ts', 'cases/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: 'The engine must stay independent of Vue.' },
            { name: 'three', message: 'The engine must stay independent of Three.js.' },
          ],
          patterns: [
            { group: ['@slidev/*'], message: 'The engine must stay independent of Slidev.' },
            {
              group: ['@simulaciencia/visuals*'],
              message: 'Dependencies point from visuals to the engine, never back.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'The engine must not touch the DOM.' },
        { name: 'window', message: 'The engine must not touch the DOM.' },
        {
          name: 'requestAnimationFrame',
          message: 'Simulation time must be independent of the frame clock.',
        },
      ],
    },
  },

  {
    files: ['tests/**/*.ts', '**/*.config.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  prettier,
);
