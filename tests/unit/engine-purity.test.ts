// @vitest-environment node
// This suite reads the repository from disk, which needs real Node globals
// rather than the jsdom shims the rendering tests use.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The architectural rule from docs/architecture.md, enforced instead of
 * merely documented: the engine and the cases must stay runnable without a
 * browser, a renderer or a component framework.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const PURE_ROOTS = [
  'packages/core/src',
  'packages/schemas/src',
  'cases/inverse-transform/src',
  'cases/poisson-counting/src',
  'cases/radioactive-decay/src',
];

/**
 * `TeachingStage` is a PRESENTATION concept and lives in `packages/visuals`.
 * The engine must never learn about it: a case that could ask "which stage am
 * I in?" would be able to compute different numbers for different slides, which
 * is exactly the confusion between science and pedagogy this project refuses.
 */
const FORBIDDEN_PRESENTATION = [/TeachingStage/, /stageFeatures/, /teaching\/stages/];

const FORBIDDEN_IMPORTS = [/from\s+['"]vue['"]/, /from\s+['"]three['"]/, /from\s+['"]@slidev\//];
const FORBIDDEN_GLOBALS = [
  /\bdocument\./,
  /\bwindow\./,
  /\brequestAnimationFrame\(/,
  /\bMath\.random\(/,
  /\bDate\.now\(/,
  /\bperformance\.now\(/,
];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * The patterns below describe forbidden CODE, and prose is not code: a doc
 * comment that legitimately ends a sentence with the word "window" is not a
 * DOM access, and a comment explaining why teaching stages are forbidden is
 * not an import of one. Scanning the raw text made both of those fail, which
 * would have pushed authors toward writing worse comments to appease a test.
 */
function stripComments(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n')
      // `[^:]` guards the one place `//` legitimately appears in code here: a URL.
      .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
      .join('\n')
  );
}

describe('engine purity', () => {
  const files = PURE_ROOTS.flatMap((relative) => collectFiles(join(ROOT, relative)));

  it('finds the engine sources it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('never imports Vue, Three.js or Slidev', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of FORBIDDEN_IMPORTS) {
        if (pattern.test(source)) offenders.push(`${file} matches ${String(pattern)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never learns about teaching stages, which belong to the presentation layer', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of FORBIDDEN_PRESENTATION) {
        if (pattern.test(source)) offenders.push(`${file} matches ${String(pattern)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never touches the DOM, the frame clock, the wall clock or Math.random', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of FORBIDDEN_GLOBALS) {
        if (pattern.test(source)) offenders.push(`${file} matches ${String(pattern)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
