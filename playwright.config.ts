import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright is used sparingly and only for what jsdom genuinely cannot answer:
 * does the production build actually boot, mount both laboratories, and paint?
 * Everything statistical is covered by fast deterministic unit tests.
 *
 * Both servers serve real production builds, not dev servers, so a build-only
 * regression (a bad `base`, a broken `optimizeDeps.exclude`) is caught here.
 */
const GALLERY_PORT = 4321;
const CLASSROOM_PORT = 4322;

export const GALLERY_URL = `http://127.0.0.1:${GALLERY_PORT}`;
export const CLASSROOM_URL = `http://127.0.0.1:${CLASSROOM_PORT}`;

/**
 * Some sandboxes ship a pre-installed Chromium that does not match the build
 * this Playwright release would download, and cannot reach the CDN to fetch
 * the matching one. Point at the local binary when it is there; otherwise let
 * Playwright resolve its own, which is what a normal developer machine does.
 */
const LOCAL_CHROMIUM = process.env.SIMULACIENCIA_CHROMIUM ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: GALLERY_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Headless Chromium falls back to SwiftShader for WebGL. Without
          // these flags the 3D chamber would silently take the 2D fallback
          // path and the smoke test would not exercise Three.js at all.
          args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
          ...(executablePath !== undefined ? { executablePath } : {}),
        },
      },
    },
  ],

  webServer: [
    {
      command: `pnpm --filter @simulaciencia/gallery exec vite preview --port ${GALLERY_PORT} --strictPort`,
      url: GALLERY_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @simulaciencia/classroom exec vite preview --outDir dist --port ${CLASSROOM_PORT} --strictPort`,
      url: CLASSROOM_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
