// @vitest-environment node
// This suite reads the repository from disk, which needs real Node globals
// rather than the jsdom shims the rendering tests use.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEACHING_STAGES } from '@simulaciencia/visuals';
import { describe, expect, it } from 'vitest';

/**
 * Properties of the classroom decks that are true of the SOURCE, checked here
 * rather than in a browser.
 *
 * Playwright answers "does it paint"; nine navigations through a WebGL deck to
 * answer "is every stage present" is slow, flaky, and no more convincing than
 * reading the file. The per-stage browser tests in `tests/e2e/classroom.spec.ts`
 * still assert what each stage actually renders.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CLASSROOM = join(ROOT, 'apps/classroom');
const DECK = join(CLASSROOM, 'slides.md');
const DEMO_DECK = join(CLASSROOM, 'demo-inverse-transform.md');

const deck = readFileSync(DECK, 'utf8');

/** Every `<PoissonSlide …/>` in the deck, with its parsed attributes. */
function poissonSlides(): { stage: string; initialWindows: number; raw: string }[] {
  return [...deck.matchAll(/<PoissonSlide\b([^>]*)\/>/g)].map((match) => {
    const raw = match[1] as string;
    const stage = /stage="([^"]+)"/.exec(raw)?.[1] ?? '';
    const windows = /:initial-windows="(\d+)"/.exec(raw)?.[1];
    return { stage, initialWindows: windows === undefined ? 0 : Number(windows), raw };
  });
}

describe('Clase 01 deck source', () => {
  it('is the deck the primary build commands point at', () => {
    const manifest = JSON.parse(readFileSync(join(CLASSROOM, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.dev).toContain('slides.md');
    expect(manifest.scripts.build).toContain('slides.md');
    expect(manifest.scripts['build:pages']).toContain('--base /simulaciencia/');
  });

  it('keeps the inverse-transform demonstration reachable under its own command', () => {
    expect(existsSync(DEMO_DECK)).toBe(true);
    const demo = readFileSync(DEMO_DECK, 'utf8');
    expect(demo).toContain('Inverse transform sampling');

    const manifest = JSON.parse(readFileSync(join(CLASSROOM, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts['dev:demo']).toContain('demo-inverse-transform.md');
    expect(manifest.scripts['build:demo']).toContain('demo-inverse-transform.md');
  });

  it('carries the Spanish title and every key slide heading', () => {
    expect(deck).toContain(
      "title: 'SimulaCiencia — Clase 01 — Conteos aleatorios y distribución de Poisson'",
    );
    for (const heading of [
      '# El fenómeno',
      '# Una ventana',
      '# La variable aleatoria',
      '# Repetir el experimento',
      '# La distribución aparece',
      '# Modelo de Poisson',
      '# Verificar, no sólo mirar',
      '# Conexión con la exponencial',
      '# Ejercicio interactivo',
      '# Cierre',
    ]) {
      expect(deck).toContain(heading);
    }
  });

  it('uses every teaching stage, in pedagogical order', () => {
    const stages = poissonSlides().map((slide) => slide.stage);
    // Every stage appears …
    for (const stage of TEACHING_STAGES) expect(stages).toContain(stage);
    // … and the first time each appears follows the pedagogical order.
    const firstAppearance = TEACHING_STAGES.map((stage) => stages.indexOf(stage));
    expect(firstAppearance).toEqual([...firstAppearance].sort((a, b) => a - b));
  });

  it('reveals more observations as the lesson advances', () => {
    const byStage = new Map(poissonSlides().map((slide) => [slide.stage, slide.initialWindows]));
    expect(byStage.get('scene')).toBe(0);
    expect(byStage.get('manual')).toBe(0);
    expect(byStage.get('counter')).toBe(1);
    expect(byStage.get('automatic')).toBe(5);
    expect(byStage.get('histogram')).toBe(40);
    expect(byStage.get('theory')).toBe(40);
  });

  it('shows the theory slide exactly the observations the histogram slide showed', () => {
    const slides = poissonSlides();
    const histogram = slides.find((slide) => slide.stage === 'histogram');
    const theory = slides.find((slide) => slide.stage === 'theory');
    expect(histogram).toBeDefined();
    expect(theory).toBeDefined();

    // Same window count …
    expect(theory!.initialWindows).toBe(histogram!.initialWindows);
    // … and neither overrides the seed or the parameters, so both inherit the
    // one fixed configuration the whole lesson runs on.
    for (const slide of [histogram!, theory!]) {
      expect(slide.raw).not.toMatch(/seed=/);
      expect(slide.raw).not.toMatch(/rate=/);
      expect(slide.raw).not.toMatch(/window-duration=/);
    }
  });

  it('runs the whole lesson on one documented seed', () => {
    expect(deck).toContain('semilla 20260801');
    const wrapper = readFileSync(join(CLASSROOM, 'components/PoissonSlide.vue'), 'utf8');
    expect(wrapper).toContain('seed: 20260801');
    expect(wrapper).toContain('rate: 3');
    expect(wrapper).toContain('windowDuration: 1');
  });

  it('gives every slide Spanish presenter notes', () => {
    const notes = [...deck.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1] as string);
    // One per slide, and the title slide has one too.
    expect(notes.length).toBeGreaterThanOrEqual(10);
    for (const note of notes) {
      expect(note).toContain('Qué');
    }
    // The three things a presenter note in this project has to answer.
    const joined = notes.join('\n');
    expect(joined).toContain('Qué hacer');
    expect(joined).toContain('Qué preguntar');
    expect(joined).toContain('Idea estadística visible');
  });

  it('never lets an essential control hide behind a click reveal', () => {
    // `v-click` may stage an explanation, never a `<PoissonSlide>`: a laboratory
    // the instructor has to click into is a laboratory that is missing when a
    // student opens the deck on their own.
    const clickBlocks = [...deck.matchAll(/<v-click>([\s\S]*?)<\/v-click>/g)].map(
      (m) => m[1] as string,
    );
    for (const block of clickBlocks) {
      expect(block).not.toContain('<PoissonSlide');
    }
  });
});

describe('Clase 01 static build', () => {
  const dist = join(CLASSROOM, 'dist');

  it.runIf(existsSync(dist))('produces an index.html with its own assets', () => {
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).toContain('Clase 01 — Conteos aleatorios y distribución de Poisson');

    const assets = readdirSync(join(dist, 'assets'));
    expect(assets.some((file) => file.endsWith('.js'))).toBe(true);
    expect(assets.some((file) => file.endsWith('.css'))).toBe(true);

    // A relative base is what makes the CI artifact servable from any folder.
    expect(index).toMatch(/(src|href)="\.\/assets\//);
  });
});
