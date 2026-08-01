/**
 * Closed-form exponential distribution.
 *
 * Both cases compare simulated samples against these functions, so the
 * "theoretical" curve on a slide and the tolerance in a unit test come from
 * one implementation.
 */

export interface CurvePoint {
  readonly x: number;
  readonly y: number;
}

function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Exponential rate must be a positive finite number, received ${rate}.`);
  }
}

/** Probability density `f(x) = λ e^{−λx}` for `x ≥ 0`, else 0. */
export function exponentialPdf(x: number, rate: number): number {
  assertRate(rate);
  if (x < 0) return 0;
  return rate * Math.exp(-rate * x);
}

/** Cumulative distribution `F(x) = 1 − e^{−λx}` for `x ≥ 0`, else 0. */
export function exponentialCdf(x: number, rate: number): number {
  assertRate(rate);
  if (x < 0) return 0;
  return -Math.expm1(-rate * x);
}

/** Survival `S(x) = e^{−λx}` — the theoretical decay curve. */
export function exponentialSurvival(x: number, rate: number): number {
  assertRate(rate);
  if (x < 0) return 1;
  return Math.exp(-rate * x);
}

/** Quantile `F⁻¹(u) = −ln(1 − u) / λ` — the inverse transform itself. */
export function exponentialQuantile(u: number, rate: number): number {
  assertRate(rate);
  if (!(u >= 0) || u >= 1) {
    if (u === 1) return Infinity;
    throw new Error(`Quantile argument must lie in [0, 1), received ${u}.`);
  }
  return -Math.log1p(-u) / rate;
}

export const exponentialMean = (rate: number): number => {
  assertRate(rate);
  return 1 / rate;
};

export const exponentialVariance = (rate: number): number => {
  assertRate(rate);
  return 1 / (rate * rate);
};

/** Median lifetime, `ln 2 / λ` — the half-life of the decay case. */
export const exponentialHalfLife = (rate: number): number => {
  assertRate(rate);
  return Math.LN2 / rate;
};

/** Sample a closed-form curve on `[from, to]` for plotting. */
export function sampleCurve(
  fn: (x: number) => number,
  from: number,
  to: number,
  points = 120,
): readonly CurvePoint[] {
  const n = Math.max(2, Math.floor(points));
  const out: CurvePoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = from + ((to - from) * i) / (n - 1);
    out.push({ x, y: fn(x) });
  }
  return Object.freeze(out);
}
