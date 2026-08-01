import type { Samples } from './moments.ts';

export interface HistogramBin {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly mid: number;
  readonly count: number;
  /** `count / n` — sums to 1 across bins. */
  readonly frequency: number;
  /** `count / (n · binWidth)` — directly comparable to a probability density. */
  readonly density: number;
}

export interface Histogram {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly binWidth: number;
  readonly bins: readonly HistogramBin[];
}

export interface HistogramOptions {
  readonly bins?: number;
  readonly min?: number;
  readonly max?: number;
}

/**
 * Fixed-width binning on `[min, max]`.
 *
 * Values outside the explicit range are dropped, not clamped: the density
 * comparison against a theoretical curve is only honest if the histogram is
 * normalised by the number of values it actually shows.
 */
export function histogram(samples: Samples, options: HistogramOptions = {}): Histogram {
  const binCount = Math.max(1, Math.floor(options.bins ?? 30));
  const n = samples.length;

  let lo = options.min;
  let hi = options.max;
  if (lo === undefined || hi === undefined) {
    let dataMin = Infinity;
    let dataMax = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i] as number;
      if (v < dataMin) dataMin = v;
      if (v > dataMax) dataMax = v;
    }
    if (!Number.isFinite(dataMin)) {
      dataMin = 0;
      dataMax = 1;
    }
    lo = lo ?? dataMin;
    hi = hi ?? dataMax;
  }
  if (!(hi > lo)) hi = lo + 1;

  const binWidth = (hi - lo) / binCount;
  const counts = new Int32Array(binCount);
  let inRange = 0;

  for (let i = 0; i < n; i += 1) {
    const v = samples[i] as number;
    if (!Number.isFinite(v) || v < lo || v > hi) continue;
    // The closed upper edge belongs to the last bin.
    const raw = Math.floor((v - lo) / binWidth);
    const index = raw >= binCount ? binCount - 1 : raw;
    counts[index] = (counts[index] as number) + 1;
    inRange += 1;
  }

  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i += 1) {
    const count = counts[i] as number;
    const start = lo + i * binWidth;
    const end = start + binWidth;
    bins.push({
      index: i,
      start,
      end,
      mid: start + binWidth / 2,
      count,
      frequency: inRange === 0 ? 0 : count / inRange,
      density: inRange === 0 ? 0 : count / (inRange * binWidth),
    });
  }

  return { count: inRange, min: lo, max: hi, binWidth, bins: Object.freeze(bins) };
}

/**
 * Freedman–Diaconis bin count, clamped to a range that stays readable on a
 * slide. Used as the default when a case does not pin the bin count itself.
 */
export function suggestBinCount(samples: Samples, maxBins = 60): number {
  const n = samples.length;
  if (n < 2) return 1;
  return Math.min(maxBins, Math.max(5, Math.ceil(Math.sqrt(n))));
}
