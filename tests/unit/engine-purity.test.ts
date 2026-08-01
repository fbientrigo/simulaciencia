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
  'cases/radioactive-decay/src',
];

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

describe('engine purity', () => {
  const files = PURE_ROOTS.flatMap((relative) => collectFiles(join(ROOT, relative)));

  it('finds the engine sources it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('never imports Vue, Three.js or Slidev', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_IMPORTS) {
        if (pattern.test(source)) offenders.push(`${file} matches ${String(pattern)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never touches the DOM, the frame clock, the wall clock or Math.random', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_GLOBALS) {
        if (pattern.test(source)) offenders.push(`${file} matches ${String(pattern)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
