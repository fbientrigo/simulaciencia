import type { Samples } from './moments.ts';

export interface CdfPoint {
  readonly x: number;
  readonly p: number;
}

/**
 * Empirical CDF as step points, `F̂(x_(i)) = i / n`.
 *
 * Returns at most `maxPoints` evenly spaced order statistics so a 100 000
 * sample run still renders as a light SVG path. The first and last points are
 * always kept, so the curve visibly starts near 0 and ends at 1.
 */
export function empiricalCdf(samples: Samples, maxPoints = 200): readonly CdfPoint[] {
  const n = samples.length;
  if (n === 0) return Object.freeze([]);

  const sorted = Float64Array.from(samples as ArrayLike<number>);
  sorted.sort();

  const wanted = Math.max(2, Math.min(maxPoints, n));
  const points: CdfPoint[] = [];
  let previousIndex = -1;

  for (let k = 0; k < wanted; k += 1) {
    const index = Math.round((k * (n - 1)) / (wanted - 1));
    if (index === previousIndex) continue;
    previousIndex = index;
    points.push({ x: sorted[index] as number, p: (index + 1) / n });
  }

  return Object.freeze(points);
}

/** Evaluate the empirical CDF at an arbitrary point. Linear scan; used in tests. */
export function empiricalCdfAt(samples: Samples, x: number): number {
  const n = samples.length;
  if (n === 0) return NaN;
  let below = 0;
  for (let i = 0; i < n; i += 1) {
    if ((samples[i] as number) <= x) below += 1;
  }
  return below / n;
}

/**
 * Kolmogorov–Smirnov style supremum distance between the empirical CDF and a
 * reference CDF. Deterministic given a seed, so tests assert against a fixed
 * bound rather than a p-value.
 */
export function maxCdfDeviation(samples: Samples, referenceCdf: (x: number) => number): number {
  const n = samples.length;
  if (n === 0) return NaN;
  const sorted = Float64Array.from(samples as ArrayLike<number>);
  sorted.sort();
  let worst = 0;
  for (let i = 0; i < n; i += 1) {
    const f = referenceCdf(sorted[i] as number);
    const above = Math.abs((i + 1) / n - f);
    const below = Math.abs(f - i / n);
    worst = Math.max(worst, above, below);
  }
  return worst;
}
