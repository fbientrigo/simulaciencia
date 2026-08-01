import { expect, test } from '@playwright/test';

/**
 * Does the built gallery boot and mount both laboratories?
 * This is the only place where "the pixels really appear" is asserted.
 */
test.describe('gallery', () => {
  test('loads both interactive cases from the production build', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));

    await page.goto('/');

    const explorer = page.getByTestId('inverse-transform-explorer');
    const chamber = page.getByTestId('decay-chamber-3d');
    await expect(explorer).toBeVisible();
    await expect(chamber).toBeVisible();

    // The inverse-transform case renders real data, not an empty frame.
    await expect(explorer.locator('.sc-mark-bar').first()).toBeVisible();
    expect(await explorer.locator('.sc-mark-bar').count()).toBeGreaterThan(5);
    await expect(explorer).toContainText('/ 500 drawn');

    // The decay case renders its chamber and its synchronized survival curve.
    await expect(chamber.getByTestId('decay-chamber-shell')).toBeVisible();
    expect(await chamber.locator('.sc-mark-curve').count()).toBeGreaterThanOrEqual(2);
    await expect(chamber).toContainText('400 / 400 remaining');

    expect(failures).toEqual([]);
  });

  test('uses WebGL 2 when the browser provides it', async ({ page }) => {
    await page.goto('/');
    const chamber = page.getByTestId('decay-chamber-3d');

    const hasWebGL2 = await page.evaluate(
      () => document.createElement('canvas').getContext('webgl2') !== null,
    );

    if (hasWebGL2) {
      await expect(chamber.getByTestId('decay-canvas')).toBeVisible();
      await expect(chamber.getByTestId('decay-fallback')).toHaveCount(0);
      const size = await chamber.getByTestId('decay-canvas').boundingBox();
      expect(size?.width ?? 0).toBeGreaterThan(50);
    } else {
      // The fallback is a supported outcome, not a failure.
      await expect(chamber.getByTestId('decay-fallback')).toBeVisible();
    }
  });

  test('a frozen URL config reproduces the identical picture on reload', async ({ page }) => {
    const frozen = '/?case=radioactive-decay&seed=987654&initialCount=300&rate=0.5&t=3&mode=embed';

    await page.goto(frozen);
    const chamber = page.getByTestId('decay-chamber-3d');
    await expect(chamber).toBeVisible();
    const firstReadout = await chamber.locator('.sc-hint.sc-numeric').first().textContent();
    const firstCurve = await chamber.locator('.sc-mark-curve--empirical').first().getAttribute('d');

    await page.reload();
    await expect(chamber).toBeVisible();
    const secondReadout = await chamber.locator('.sc-hint.sc-numeric').first().textContent();
    const secondCurve = await chamber
      .locator('.sc-mark-curve--empirical')
      .first()
      .getAttribute('d');

    expect(firstReadout).toBe(secondReadout);
    expect(firstCurve).toBe(secondCurve);
    // The URL pinned t = 3, so the run really was fast-forwarded, not reset.
    expect(firstReadout).toContain('t = 3.00s');
    expect(firstReadout).not.toContain('300 / 300 remaining');
  });

  test('a different seed changes the picture', async ({ page }) => {
    await page.goto('/?case=radioactive-decay&seed=111&initialCount=300&rate=0.5&t=3');
    const a = await page
      .getByTestId('decay-chamber-3d')
      .locator('.sc-mark-curve--empirical')
      .first()
      .getAttribute('d');

    await page.goto('/?case=radioactive-decay&seed=222&initialCount=300&rate=0.5&t=3');
    const b = await page
      .getByTestId('decay-chamber-3d')
      .locator('.sc-mark-curve--empirical')
      .first()
      .getAttribute('d');

    expect(a).not.toBe(b);
  });

  test('the inverse-transform controls drive the engine', async ({ page }) => {
    await page.goto('/?case=inverse-transform&seed=42&rate=1.5&sampleCount=300&t=1');
    const explorer = page.getByTestId('inverse-transform-explorer');
    await expect(explorer).toContainText('50 / 300 drawn');

    await explorer.getByRole('button', { name: 'Step one draw' }).click();
    await expect(explorer).toContainText('51 / 300 drawn');

    await explorer.getByRole('button', { name: 'Draw all' }).click();
    await expect(explorer).toContainText('300 / 300 drawn');

    await explorer.getByRole('button', { name: 'Reset' }).click();
    await expect(explorer).toContainText('0 / 300 drawn');
  });
  test('mounts the Poisson laboratory and honours the stage in the URL', async ({ page }) => {
    await page.goto(
      '/?case=poisson-counting&seed=20260801&rate=3&windowDuration=1&maxWindows=600&t=100&stage=diagnostics',
    );
    const lab = page.getByTestId('poisson-counting-lab');
    await expect(lab).toBeVisible();
    await expect(lab).toHaveAttribute('data-stage', 'diagnostics');
    // t = 100 at a 0.25 s step is 400 revealed observation windows.
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('400');
    await expect(lab.getByTestId('diagnostic-fano')).toHaveText('1.023');
    await expect(lab.getByTestId('poisson-pmf-curve')).toBeVisible();

    // Selecting an earlier stage takes features away and never adds any.
    await page.goto(
      '/?case=poisson-counting&seed=20260801&rate=3&windowDuration=1&maxWindows=600&t=100&stage=histogram',
    );
    const earlier = page.getByTestId('poisson-counting-lab');
    await expect(earlier).toHaveAttribute('data-stage', 'histogram');
    await expect(earlier.getByTestId('discrete-count-chart')).toBeVisible();
    await expect(earlier.getByTestId('poisson-pmf-curve')).toHaveCount(0);
    await expect(earlier.getByTestId('poisson-diagnostics')).toHaveCount(0);
  });

  test('the Poisson laboratory can be forced onto the flat fallback', async ({ page }) => {
    await page.goto(
      '/?case=poisson-counting&seed=20260801&rate=3&windowDuration=1&maxWindows=600&t=10&stage=counter&fallback=1',
    );
    const lab = page.getByTestId('poisson-counting-lab');
    const fallback = lab.getByTestId('poisson-detector-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('WebGL 2 no está disponible');
    // The statistics are identical to the WebGL path; only the drawing changed.
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('40');
  });

  test('one manual click on the Poisson laboratory adds exactly one observation', async ({
    page,
  }) => {
    await page.goto(
      '/?case=poisson-counting&seed=20260801&rate=3&windowDuration=1&maxWindows=600&t=1.25&stage=automatic',
    );
    const lab = page.getByTestId('poisson-counting-lab');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('5');

    await lab.getByTestId('poisson-sample-window').click();
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('6');

    await lab.getByTestId('poisson-reset').click();
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('5');
  });
});
