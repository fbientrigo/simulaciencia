import { expect, test } from '@playwright/test';
import { CLASSROOM_URL } from '../../playwright.config.ts';

/**
 * Slidev requests a screen wake lock when the deck boots. Chromium headless
 * denies that permission and surfaces it as a page error even though the deck
 * remains fully functional. Keep the smoke test strict for every other error.
 */
const BENIGN_PAGE_ERRORS = new Set(['Wake Lock permission request denied']);

/**
 * The Slidev deck must not just build — it must boot as static HTML and mount
 * the same interactive components the gallery uses.
 */
test.describe('classroom deck', () => {
  test('serves the title slide from the static build', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => {
      if (!BENIGN_PAGE_ERRORS.has(error.message)) failures.push(error.message);
    });

    await page.goto(`${CLASSROOM_URL}/`);
    await expect(page.locator('body')).toContainText('SimulaCiencia');
    await expect(page.locator('body')).toContainText('Modelar · Simular · Comprender');
    expect(failures).toEqual([]);
  });

  test('renders LaTeX from the Markdown source rather than an image', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/3`);
    await expect(page.locator('body')).toContainText('Inverse transform sampling');

    // Slidev keeps neighbouring slides mounted but hidden, so filter to the
    // maths that is actually on screen rather than the first node in the DOM.
    const visibleMath = page.locator('.katex').filter({ visible: true });
    await expect(visibleMath.first()).toBeVisible();
    expect(await visibleMath.count()).toBeGreaterThan(1);

    // KaTeX output, not a picture: the maths stays editable in slides.md.
    expect(await page.locator('.slidev-layout img').count()).toBe(0);
  });

  test('mounts the inverse-transform explorer on its slide', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/4`);
    const explorer = page.getByTestId('inverse-transform-explorer').first();
    await expect(explorer).toBeVisible();
    expect(await explorer.locator('.sc-mark-curve').count()).toBeGreaterThanOrEqual(2);
  });

  test('mounts the 3D decay chamber on its slide', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/5`);
    const chamber = page.getByTestId('decay-chamber-3d').first();
    await expect(chamber).toBeVisible();
    await expect(chamber.getByTestId('decay-chamber-shell').first()).toBeVisible();
    await expect(chamber).toContainText('400 / 400 remaining');
  });

  test('computes the validation table live on the slide', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/7`);
    const body = page.locator('body');
    // 1/λ for λ = 1.5, produced by the engine at render time.
    await expect(body).toContainText('0.6667');
    await expect(body).toContainText('50,000');
    await expect(body).toContainText('Validated');
  });
});
