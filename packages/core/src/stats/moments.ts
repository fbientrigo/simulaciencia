/** Read-only numeric input accepted by every statistics helper. */
export type Samples = ArrayLike<number>;

export interface SampleSummary {
  readonly count: number;
  readonly mean: number;
  /** Unbiased (n − 1) sample variance. `NaN` for fewer than two samples. */
  readonly variance: number;
  readonly standardDeviation: number;
  /** Monte Carlo standard error of the mean, `s / √n`. */
  readonly standardError: number;
  readonly min: number;
  readonly max: number;
}

export function mean(samples: Samples): number {
  const n = samples.length;
  if (n === 0) return NaN;
  let total = 0;
  for (let i = 0; i < n; i += 1) total += samples[i] as number;
  return total / n;
}

/**
 * Variance via a two-pass algorithm — the naive `E[X²] − E[X]²` form loses
 * catastrophic precision for the large, tightly clustered samples the lessons
 * use, and precision matters when the slide claims empirical ≈ theoretical.
 */
export function variance(samples: Samples, options: { population?: boolean } = {}): number {
  const n = samples.length;
  const ddof = options.population === true ? 0 : 1;
  if (n - ddof <= 0) return NaN;
  const mu = mean(samples);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const d = (samples[i] as number) - mu;
    sum += d * d;
  }
  return sum / (n - ddof);
}

export function standardDeviation(
  samples: Samples,
  options: { population?: boolean } = {},
): number {
  return Math.sqrt(variance(samples, options));
}

/**
 * Monte Carlo standard error of the sample mean.
 * This is the number that tells a student how much of the gap between
 * empirical and theoretical is just noise.
 */
export function monteCarloStandardError(samples: Samples): number {
  const n = samples.length;
  if (n < 2) return NaN;
  return standardDeviation(samples) / Math.sqrt(n);
}

export function summarize(samples: Samples): SampleSummary {
  const n = samples.length;
  if (n === 0) {
    return {
      count: 0,
      mean: NaN,
      variance: NaN,
      standardDeviation: NaN,
      standardError: NaN,
      min: NaN,
      max: NaN,
    };
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const v = samples[i] as number;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const v = variance(samples);
  const sd = Math.sqrt(v);
  return {
    count: n,
    mean: mean(samples),
    variance: v,
    standardDeviation: sd,
    standardError: n < 2 ? NaN : sd / Math.sqrt(n),
    min,
    max,
  };
}
