import { expect, test, type Locator, type Page } from '@playwright/test';

function poissonPermalink(page: Page): Locator {
  const lab = page.getByTestId('poisson-counting-lab');
  return page.locator('section.sc-stack').filter({ has: lab }).locator('.gallery__permalink code');
}

async function permalinkQuery(locator: Locator): Promise<URLSearchParams> {
  const text = await locator.textContent();
  if (text === null) throw new Error('Poisson permalink was not rendered.');
  return new URL(text).searchParams;
}

test.describe('Poisson deterministic permalink', () => {
  test('floors partial fixed steps when restoring URL time', async ({ page }) => {
    await page.goto(
      '/?case=poisson-counting&seed=20260801&rate=3&windowDuration=1&maxWindows=600&t=0.2&stage=counter',
    );

    const lab = page.getByTestId('poisson-counting-lab');
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('0');
    await expect
      .poll(async () => (await permalinkQuery(poissonPermalink(page))).get('t'))
      .toBe('0');
  });

  test('tracks sampling and editable parameters from the live lab state', async ({ page }) => {
    await page.goto(
      '/?case=poisson-counting&seed=20260801&rate=3&windowDuration=1&maxWindows=600&t=1.25&stage=automatic',
    );

    const lab = page.getByTestId('poisson-counting-lab');
    const permalink = poissonPermalink(page);

    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('5');
    await lab.getByTestId('poisson-sample-window').click();
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('6');
    await expect.poll(async () => (await permalinkQuery(permalink)).get('t')).toBe('1.5');

    const rate = lab.getByRole('spinbutton', { name: 'Tasa λ (exact value)' });
    await rate.fill('4.2');
    await rate.press('Tab');

    const duration = lab.getByRole('spinbutton', {
      name: 'Duración de la ventana Δt (exact value)',
    });
    await duration.fill('1.5');
    await duration.press('Tab');

    const budget = lab.getByRole('spinbutton', { name: 'Ventanas disponibles (exact value)' });
    await budget.fill('800');
    await budget.press('Tab');

    const seed = lab.getByRole('spinbutton', { name: 'Semilla' });
    await seed.fill('42');
    await seed.press('Tab');

    // Parameter edits restart the deterministic run at its configured initial
    // window count; the permalink must describe that picture, not the old one.
    await expect(lab.getByTestId('poisson-revealed-windows')).toHaveText('5');
    await expect.poll(async () => (await permalinkQuery(permalink)).get('rate')).toBe('4.2');
    await expect
      .poll(async () => (await permalinkQuery(permalink)).get('windowDuration'))
      .toBe('1.5');
    await expect.poll(async () => (await permalinkQuery(permalink)).get('maxWindows')).toBe('800');
    await expect.poll(async () => (await permalinkQuery(permalink)).get('seed')).toBe('42');
    await expect.poll(async () => (await permalinkQuery(permalink)).get('t')).toBe('1.25');
  });
});
