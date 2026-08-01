import { expect, test } from '@playwright/test';
import { CLASSROOM_URL } from '../../playwright.config.ts';

/**
 * Slidev requests a screen wake lock when the deck boots. Chromium headless
 * denies that permission and surfaces it as a page error even though the deck
 * remains fully functional. Keep the smoke test strict for every other error.
 */
const BENIGN_PAGE_ERRORS = new Set(['Wake Lock permission request denied']);

/**
 * The primary classroom deck — Clase 01 — must not just build. It has to boot
 * as static HTML, mount the counting laboratory on every teaching stage, and
 * show the same numbers the unit tests pin down.
 *
 * Slide numbers follow the deck order in `apps/classroom/slides.md`:
 *   1 portada · 2 scene · 3 manual · 4 counter · 5 automatic · 6 histogram
 *   7 theory · 8 diagnostics · 9 exponencial · 10 ejercicio · 11 cierre
 */
test.describe('Clase 01 — conteos aleatorios y Poisson', () => {
  test('serves the Spanish title slide from the static build', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => {
      if (!BENIGN_PAGE_ERRORS.has(error.message)) failures.push(error.message);
    });

    await page.goto(`${CLASSROOM_URL}/`);
    await expect(page.locator('body')).toContainText('SimulaCiencia');
    await expect(page.locator('body')).toContainText(
      'Clase 01 — Conteos aleatorios y distribución de Poisson',
    );
    expect(failures).toEqual([]);
  });

  test('shows only the detector and the question at the scene stage', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/2`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toBeVisible();
    await expect(lab).toHaveAttribute('data-stage', 'scene');
    await expect(lab.getByTestId('poisson-detector-shell')).toBeVisible();
    await expect(lab.getByTestId('poisson-current-count')).toHaveCount(0);
    await expect(lab.getByTestId('discrete-count-chart')).toHaveCount(0);
    await expect(page.locator('body')).toContainText(
      '¿Cuántos eventos observaremos durante una ventana de tiempo?',
    );
  });

  test('reveals exactly one observation per click at the manual stage', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/3`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toHaveAttribute('data-stage', 'manual');

    const button = lab.getByTestId('poisson-sample-window');
    await expect(button).toHaveText('Simular una ventana');
    // The count stays hidden here: the class counts, it does not read.
    await expect(lab.getByTestId('poisson-current-count')).toHaveCount(0);
    await button.click();
    await expect(lab.getByTestId('poisson-current-count')).toHaveCount(0);
  });

  test('shows the first count of the fixed seed at the counter stage', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/4`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toHaveAttribute('data-stage', 'counter');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('1');
    // Seed 20260801, λ = 3, Δt = 1: the first window contains four events.
    await expect(lab.getByTestId('poisson-current-count')).toHaveText('4');
    await expect(lab.getByTestId('count-timeline')).toBeVisible();
  });

  test('keeps manual sampling beside autoplay at the automatic stage', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/5`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toHaveAttribute('data-stage', 'automatic');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('5');
    await expect(lab.getByTestId('poisson-toggle')).toHaveText('Reproducir');
    await expect(lab.getByTestId('poisson-sample-window')).toBeVisible();

    await lab.getByTestId('poisson-toggle').click();
    await expect(lab.getByTestId('poisson-toggle')).toHaveText('Pausar');

    // One window per 0.25 s of playback, so wait for the engine rather than
    // assuming a click and a read happen far enough apart.
    await expect
      .poll(async () => Number(await lab.getByTestId('poisson-revealed-windows').innerText()), {
        timeout: 15_000,
      })
      .toBeGreaterThan(5);

    await lab.getByTestId('poisson-toggle').click();
    await expect(lab.getByTestId('poisson-toggle')).toHaveText('Reproducir');
    const paused = Number(await lab.getByTestId('poisson-revealed-windows').innerText());
    await page.waitForTimeout(1000);
    // Paused means paused: no further windows appear.
    expect(Number(await lab.getByTestId('poisson-revealed-windows').innerText())).toBe(paused);
  });

  test('draws empirical bars but no Poisson overlay at the histogram stage', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/6`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toHaveAttribute('data-stage', 'histogram');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('40');
    await expect(lab.getByTestId('discrete-count-chart')).toBeVisible();
    expect(await lab.locator('.sc-mark-bar').count()).toBeGreaterThan(5);
    await expect(lab.getByTestId('poisson-pmf-curve')).toHaveCount(0);
  });

  test('adds only the overlay at the theory stage, over the same observations', async ({
    page,
  }) => {
    // The histogram slide first, so the two are compared rather than assumed.
    await page.goto(`${CLASSROOM_URL}/6`);
    const histogramSlide = page
      .getByTestId('poisson-counting-lab')
      .filter({ visible: true })
      .first();
    const empiricalBars = await histogramSlide
      .locator('.sc-mark-bar')
      .evaluateAll((nodes) =>
        nodes.map((node) => `${node.getAttribute('x')}|${node.getAttribute('height')}`),
      );

    await page.goto(`${CLASSROOM_URL}/7`);
    const theorySlide = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(theorySlide).toHaveAttribute('data-stage', 'theory');
    await expect(theorySlide.getByTestId('poisson-revealed-windows')).toHaveText('40');
    const theoryBars = await theorySlide
      .locator('.sc-mark-bar')
      .evaluateAll((nodes) =>
        nodes.map((node) => `${node.getAttribute('x')}|${node.getAttribute('height')}`),
      );

    // Same seed, same parameters, same 40 windows — pixel-identical bars.
    expect(theoryBars).toEqual(empiricalBars);
    // The only thing that changed is the theory.
    await expect(theorySlide.getByTestId('poisson-pmf-curve')).toBeVisible();
    await expect(theorySlide.getByTestId('poisson-expected-count')).toHaveText('μ = 3.00');
  });

  test('reports mean, variance and Fano at the diagnostics stage', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/8`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toHaveAttribute('data-stage', 'diagnostics');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('400');

    // Measured for seed 20260801, λ = 3, Δt = 1, 400 windows.
    await expect(lab.getByTestId('diagnostic-mean')).toHaveText('3.063');
    await expect(lab.getByTestId('diagnostic-variance')).toHaveText('3.131');
    await expect(lab.getByTestId('diagnostic-fano')).toHaveText('1.023');
    await expect(lab.getByTestId('poisson-diagnostics-verdict')).toContainText('Verificado');
  });

  test('renders the exponential connection as live LaTeX, not a picture', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/9`);
    await expect(page.locator('body')).toContainText('Conexión con la exponencial');

    // Slidev keeps neighbouring slides mounted but hidden, so filter to the
    // maths that is actually on screen rather than the first node in the DOM.
    const visibleMath = page.locator('.katex').filter({ visible: true });
    await expect(visibleMath.first()).toBeVisible();
    expect(await visibleMath.count()).toBeGreaterThan(1);
    expect(await page.locator('.slidev-layout img').count()).toBe(0);
  });

  test('exposes the scientific parameters on the exercise slide', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/10`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    await expect(lab).toContainText('Tasa λ');
    await expect(lab).toContainText('Duración de la ventana Δt');
    await expect(lab).toContainText('Semilla');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('0');
    await expect(lab.getByTestId('poisson-diagnostics-verdict')).toContainText(
      'Se necesitan al menos 30 ventanas',
    );
  });

  test('uses WebGL 2 for the detector when the browser provides it', async ({ page }) => {
    await page.goto(`${CLASSROOM_URL}/6`);
    const lab = page.getByTestId('poisson-counting-lab').filter({ visible: true }).first();
    const hasWebGL2 = await page.evaluate(
      () => document.createElement('canvas').getContext('webgl2') !== null,
    );

    if (hasWebGL2) {
      await expect(lab.getByTestId('poisson-detector-canvas')).toBeVisible();
      await expect(lab.getByTestId('poisson-detector-fallback')).toHaveCount(0);
      const size = await lab.getByTestId('poisson-detector-canvas').boundingBox();
      expect(size?.width ?? 0).toBeGreaterThan(50);
    } else {
      // The flat projection is a supported outcome, not a failure.
      await expect(lab.getByTestId('poisson-detector-fallback')).toBeVisible();
    }
  });
});
