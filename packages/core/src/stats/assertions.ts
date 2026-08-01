import type { Samples } from './moments.ts';

/**
 * Deterministic statistical checks.
 *
 * These return a value instead of throwing, for two reasons: unit tests can
 * assert on `ok` with a readable message, and the "empirical vs theoretical"
 * slide renders exactly the same objects as a pass/fail panel. A student sees
 * the same check the CI sees.
 *
 * Every check is a fixed-threshold invariant, never a random p-value, so a run
 * that passes today passes forever for the same seed.
 */
export interface CheckResult {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

function fmt(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(digits);
}

/** Absolute or relative closeness, whichever the caller asks for. */
export function checkClose(
  label: string,
  actual: number,
  expected: number,
  tolerance: number,
  mode: 'absolute' | 'relative' = 'relative',
): CheckResult {
  const error =
    mode === 'relative' && expected !== 0
      ? Math.abs(actual - expected) / Math.abs(expected)
      : Math.abs(actual - expected);
  const unit = mode === 'relative' ? ' (relative)' : '';
  return {
    label,
    ok: Number.isFinite(error) && error <= tolerance,
    detail: `observed ${fmt(actual)} vs expected ${fmt(expected)} — error ${fmt(error, 5)}${unit}, tolerance ${tolerance}`,
  };
}

export function checkAllFinite(label: string, samples: Samples): CheckResult {
  for (let i = 0; i < samples.length; i += 1) {
    if (!Number.isFinite(samples[i] as number)) {
      return { label, ok: false, detail: `sample ${i} is ${String(samples[i])}` };
    }
  }
  return { label, ok: true, detail: `all ${samples.length} values are finite` };
}

export function checkAllNonNegative(label: string, samples: Samples): CheckResult {
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] as number;
    if (!(v >= 0)) {
      return { label, ok: false, detail: `sample ${i} is ${String(v)}` };
    }
  }
  return { label, ok: true, detail: `all ${samples.length} values are ≥ 0` };
}

/** Used by the decay case: a survivor count may never go back up. */
export function checkNonIncreasing(label: string, series: Samples): CheckResult {
  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1] as number;
    const current = series[i] as number;
    if (current > previous) {
      return { label, ok: false, detail: `index ${i} rose from ${previous} to ${current}` };
    }
  }
  return { label, ok: true, detail: `${series.length} points are non-increasing` };
}

/** Every check must pass for the panel to read "validated". */
export function allPassed(results: readonly CheckResult[]): boolean {
  return results.every((r) => r.ok);
}
