// @vitest-environment node
// This suite reads the repository from disk, which needs real Node globals
// rather than the jsdom shims the rendering tests use.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Spanish is the classroom language of this milestone, and there is no
 * internationalization framework — so nothing but a check like this stops an
 * English label from drifting back into a slide or a control.
 *
 * The check reads only what a STUDENT reads: slide prose, presenter notes,
 * text nodes and the handful of attributes screen readers announce. It
 * deliberately does not scan code identifiers, prop names, CSS classes or
 * comments, all of which are English by project convention — a `showHistogram`
 * ref and a `histogram` prop value are not English UI text, and a check that
 * flagged them would just teach authors to obfuscate their code.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Labels that would betray an untranslated control or heading. Matched
 * case-sensitively as whole words, because a user-facing label is capitalised
 * while the same word in a prop value or a slug is not.
 */
const ENGLISH_UI_WORDS = [
  'Play',
  'Pause',
  'Reset',
  'Step',
  'Count',
  'Mean',
  'Variance',
  'Histogram',
  'Theory',
  'Diagnostics',
  // A few more that would be just as wrong in front of a class.
  'Speed',
  'Window',
  'Seed',
  'Rate',
  'Expected',
  'Observed',
];

const pattern = new RegExp(`\\b(${ENGLISH_UI_WORDS.join('|')})\\b`, 'g');

/**
 * A mustache is an expression, not prose — except for the string literals
 * inside it. `{{ playing ? 'Pausar' : 'Reproducir' }}` is exactly how a label
 * hides from a naive scanner, so the literals are lifted out and the rest of
 * the expression is dropped.
 */
function mustacheLiterals(source: string): string[] {
  const out: string[] = [];
  for (const mustache of source.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    for (const literal of (mustache[1] as string).matchAll(/'([^']*)'|"([^"]*)"/g)) {
      out.push(literal[1] ?? literal[2] ?? '');
    }
  }
  return out;
}

function stripMustaches(source: string): string {
  return source.replace(/\{\{[\s\S]*?\}\}/g, ' ');
}

/**
 * Pull the learner-visible text out of a single-file component.
 *
 * Text nodes plus the accessible-name attributes, and nothing else: a `class`,
 * a `data-testid` or a `:show-theory` binding is code, and reading it here
 * would make the check fire on the architecture rather than on the copy.
 */
const ACCESSIBLE_ATTRIBUTES = /\s(?:aria-label|title|alt|placeholder)="([^"]*)"/g;

function visibleTextFromVue(source: string): string {
  const template = /<template>([\s\S]*)<\/template>/.exec(source);
  if (template === null) return '';
  const raw = (template[1] as string).replace(/<!--[\s\S]*?-->/g, ' ');
  const literals = mustacheLiterals(raw);
  const markup = stripMustaches(raw);

  const announced: string[] = [];
  for (const match of markup.matchAll(ACCESSIBLE_ATTRIBUTES)) {
    announced.push(match[1] as string);
  }

  // Text nodes: whatever survives once every tag is removed.
  const textNodes = markup.replace(/<[^>]*>/g, '\n');
  return `${textNodes}\n${announced.join('\n')}\n${literals.join('\n')}`;
}

/**
 * Pull the learner-visible text out of a Slidev deck.
 *
 * Presenter notes ARE in scope — an instructor is a reader too, and the brief
 * asks for them in Spanish — so they are extracted before tags are stripped.
 * Front matter and component tags are not: they carry stage names and prop
 * values that are legitimately English identifiers.
 */
function visibleTextFromDeck(source: string): string {
  const withoutFrontMatter = source.replace(/^---\n[\s\S]*?\n---\n/, '\n');

  const notes: string[] = [];
  for (const match of withoutFrontMatter.matchAll(/<!--([\s\S]*?)-->/g)) {
    notes.push(match[1] as string);
  }

  const prose = withoutFrontMatter
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    // Slide separators and per-slide front matter blocks.
    .replace(/^---\n(?:[\s\S]*?\n)?---$/gm, ' ')
    .replace(/<[^>]*>/g, ' ');

  return `${prose}\n${notes.join('\n')}`;
}

function offendersIn(text: string): string[] {
  return [...new Set(text.match(pattern) ?? [])];
}

const DECK = join(ROOT, 'apps/classroom/slides.md');
const SPANISH_COMPONENTS = [
  'packages/visuals/src/components/PoissonCountingLab.vue',
  'packages/visuals/src/components/PoissonDetector3D.vue',
  'packages/visuals/src/components/PoissonDiagnostics.vue',
  'packages/visuals/src/components/DiscreteCountChart.vue',
  'packages/visuals/src/components/CountTimeline.vue',
  'apps/classroom/components/PoissonSlide.vue',
];

/**
 * Stage names and stage captions are learner-visible too — they head the
 * gallery selector and caption the laboratory — but they live in a plain
 * TypeScript module, so they are scanned as string literals rather than as
 * markup.
 */
const STAGES_MODULE = join(ROOT, 'packages/visuals/src/teaching/stages.ts');

function stringLiteralsIn(source: string): string {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  return [...withoutComments.matchAll(/'([^'\n]*)'/g)].map((m) => m[1] as string).join('\n');
}

describe('Spanish classroom content', () => {
  it('finds the primary deck where the build expects it', () => {
    const deck = readFileSync(DECK, 'utf8');
    expect(deck).toContain('Conteos aleatorios y distribución de Poisson');
    expect(deck).toContain('Clase 01');
  });

  it('leaves no English UI label in the primary deck', () => {
    const text = visibleTextFromDeck(readFileSync(DECK, 'utf8'));
    expect(offendersIn(text)).toEqual([]);
  });

  it('leaves no English UI label in any Poisson component', () => {
    for (const relative of SPANISH_COMPONENTS) {
      const text = visibleTextFromVue(readFileSync(join(ROOT, relative), 'utf8'));
      expect({ file: relative, offenders: offendersIn(text) }).toEqual({
        file: relative,
        offenders: [],
      });
    }
  });

  it('leaves no English UI label in the stage names or captions', () => {
    const text = stringLiteralsIn(readFileSync(STAGES_MODULE, 'utf8'));
    expect(text).toContain('Verificar, no sólo mirar');
    expect(offendersIn(text)).toEqual([]);
  });

  it('actually reads the text it claims to check', () => {
    // A guard against the extractor silently returning nothing and the two
    // tests above passing for the wrong reason.
    const lab = visibleTextFromVue(
      readFileSync(join(ROOT, 'packages/visuals/src/components/PoissonCountingLab.vue'), 'utf8'),
    );
    expect(lab).toContain('Simular una ventana');
    expect(lab).toContain('Reproducir');
    expect(lab).toContain('Reiniciar');

    const deck = visibleTextFromDeck(readFileSync(DECK, 'utf8'));
    expect(deck).toContain('Verificar, no sólo mirar');
    expect(deck).toContain('Qué preguntar');

    // And that it would fail on a real regression.
    expect(offendersIn('<button>Play</button>')).toEqual(['Play']);
    expect(offendersIn('un histograma en español')).toEqual([]);
  });
});
