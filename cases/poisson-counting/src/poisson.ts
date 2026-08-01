/**
 * The Poisson probability mass function, implemented locally on purpose.
 *
 * It lives in this case rather than in `packages/core` because exactly one case
 * needs it today. The moment a second case wants the same recurrence, move it —
 * not before. `docs/authoring-a-case.md` records that rule.
 *
 * Nothing here touches randomness: these are closed-form quantities the lesson
 * compares the simulated counts against.
 */

/** Fewest bars the chart will ever show, so a small μ still looks like a chart. */
const MIN_SUPPORT = 8;
/** Most bars the chart will ever show, so a large μ stays readable on a slide. */
const MAX_SUPPORT = 40;

/**
 * The largest count the x-axis displays individually.
 *
 * Derived from μ ALONE, never from the counts observed so far. That is what
 * keeps the axis still while the instructor collects observations — a support
 * that grew with the sample would make the histogram jump mid-explanation.
 *
 * `μ + 4√μ` covers roughly four standard deviations; everything beyond it is
 * aggregated into a single overflow bin.
 */
export function poissonSupportMax(mu: number): number {
  if (!Number.isFinite(mu) || mu <= 0) return MIN_SUPPORT;
  const wide = Math.ceil(mu + 4 * Math.sqrt(mu));
  return Math.min(MAX_SUPPORT, Math.max(MIN_SUPPORT, wide));
}

/**
 * `P(K = k)` for `k = 0 … kMax`, by the stable forward recurrence
 *
 *   P(0) = e^(−μ),  P(k + 1) = P(k) · μ / (k + 1).
 *
 * Written this way rather than as `e^(−μ) μ^k / k!` because both `μ^k` and `k!`
 * overflow long before their ratio does — at μ = 20 and k = 40 the factorial is
 * already ~8 × 10^47 while the probability is a perfectly ordinary 1 × 10^−6.
 */
export function poissonPmf(mu: number, kMax: number): readonly number[] {
  const size = Math.max(0, Math.floor(kMax)) + 1;
  const out = new Array<number>(size);
  let p = Math.exp(-mu);
  out[0] = p;
  for (let k = 0; k + 1 < size; k += 1) {
    p = (p * mu) / (k + 1);
    out[k + 1] = p;
  }
  return out;
}

/** `P(K > kMax)`, the mass the overflow bin represents. Never negative. */
export function poissonTailAbove(pmf: readonly number[]): number {
  let total = 0;
  for (const p of pmf) total += p;
  return Math.max(0, 1 - total);
}

/** `E[K] = Var[K] = μ`. Named so the slide and the tests read the same. */
export function poissonMean(mu: number): number {
  return mu;
}

export function poissonVariance(mu: number): number {
  return mu;
}
