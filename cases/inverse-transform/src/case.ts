import {
  checkAllFinite,
  checkAllNonNegative,
  checkClose,
  defineCase,
  empiricalCdf,
  exponentialCdf,
  exponentialMean,
  exponentialPdf,
  exponentialQuantile,
  exponentialVariance,
  histogram,
  maxCdfDeviation,
  sampleCurve,
  suggestBinCount,
  summarize,
  type CdfPoint,
  type CheckResult,
  type CurvePoint,
  type RandomSource,
  type SimulationStateBase,
} from '@simulaciencia/core';
import type { ParamSchema, SnapshotEnvelope } from '@simulaciencia/schemas';

export const INVERSE_TRANSFORM_ID = 'inverse-transform';
export const INVERSE_TRANSFORM_VERSION = '1.0.0';

/** One fixed step reveals exactly one sample, so "step" means "one draw". */
export const REVEAL_STEP_SECONDS = 0.02;

export interface InverseTransformParams extends Record<string, number> {
  /** Rate λ of the target exponential distribution. */
  rate: number;
  /** How many pairs (U, X) the experiment draws in total. */
  sampleCount: number;
}

export const inverseTransformSchema: ParamSchema<InverseTransformParams> = {
  rate: {
    kind: 'number',
    label: 'Rate λ',
    description: 'Rate of the target exponential distribution. Mean is 1/λ.',
    unit: 's⁻¹',
    default: 1.5,
    min: 0.1,
    max: 5,
    step: 0.1,
  },
  sampleCount: {
    kind: 'number',
    label: 'Sample count n',
    description: 'Number of uniform draws transformed into exponential variates.',
    default: 500,
    min: 10,
    max: 50000,
    step: 10,
    integer: true,
  },
};

export interface InverseTransformState extends SimulationStateBase {
  readonly params: InverseTransformParams;
  /** Copied from the `RandomSource` so snapshots carry their own identity. */
  readonly seed: number;
  /** All uniforms, drawn once at initialisation. */
  readonly uniforms: Float64Array;
  /** `X_i = −ln(1 − U_i) / λ`, aligned index for index with `uniforms`. */
  readonly samples: Float64Array;
  /** How many pairs are currently visible. Grows by one per step. */
  readonly revealed: number;
  /** Plot domain, fixed by λ alone so the axis never jumps while revealing. */
  readonly xMax: number;
  readonly binCount: number;
}

export interface SamplePair {
  readonly index: number;
  readonly u: number;
  readonly x: number;
}

export interface InverseTransformSnapshot extends SnapshotEnvelope {
  readonly rate: number;
  readonly sampleCount: number;
  readonly revealed: number;
  /** Revealed uniforms, in draw order. */
  readonly uniforms: readonly number[];
  /** Revealed exponential variates, in draw order. */
  readonly samples: readonly number[];
  /** The pair produced by the most recent step, for the synchronized display. */
  readonly latest: SamplePair | null;
  /** A short tail of recent pairs, used to animate the U → X mapping. */
  readonly recent: readonly SamplePair[];
  readonly histogram: ReturnType<typeof histogram>;
  readonly empiricalCdf: readonly CdfPoint[];
  readonly theoreticalDensity: readonly CurvePoint[];
  readonly theoreticalCdf: readonly CurvePoint[];
  readonly theoretical: { readonly mean: number; readonly variance: number };
  readonly empirical: {
    readonly count: number;
    readonly mean: number;
    readonly variance: number;
    readonly standardError: number;
  };
  readonly checks: readonly CheckResult[];
  readonly xMax: number;
}

export interface InverseTransformMetrics extends Record<string, number> {
  revealed: number;
  theoreticalMean: number;
  theoreticalVariance: number;
  empiricalMean: number;
  empiricalVariance: number;
  standardError: number;
  maxCdfDeviation: number;
}

const RECENT_WINDOW = 12;

function emptySnapshotArrays(): readonly number[] {
  return Object.freeze([]);
}

export const inverseTransformCase = defineCase<
  InverseTransformParams,
  InverseTransformState,
  InverseTransformSnapshot,
  InverseTransformMetrics
>({
  id: INVERSE_TRANSFORM_ID,
  version: INVERSE_TRANSFORM_VERSION,
  title: 'Inverse transform sampling',
  summary:
    'Uniform draws on (0,1) become exponential variates through X = −ln(1 − U)/λ, the inverse of the exponential CDF.',
  schema: inverseTransformSchema,
  fixedDt: REVEAL_STEP_SECONDS,

  createState(params: InverseTransformParams, rng: RandomSource): InverseTransformState {
    const n = Math.round(params.sampleCount);
    const uniforms = new Float64Array(n);
    const samples = new Float64Array(n);

    // Draw and transform in one pass so U_i and X_i are provably the same draw.
    // This is the whole lesson, so the mapping is written out rather than
    // delegated to `rng.nextExponential`.
    for (let i = 0; i < n; i += 1) {
      const u = rng.nextUniform();
      uniforms[i] = u;
      samples[i] = -Math.log1p(-u) / params.rate;
    }

    return {
      stepIndex: 0,
      time: 0,
      params,
      seed: rng.seed,
      uniforms,
      samples,
      revealed: 0,
      // 0.999 quantile keeps the tail visible without an empty half-axis.
      xMax: exponentialQuantile(0.999, params.rate),
      binCount: suggestBinCount(samples, 48),
    };
  },

  step(state: InverseTransformState): InverseTransformState {
    if (state.revealed >= state.uniforms.length) return state;
    const stepIndex = state.stepIndex + 1;
    return {
      ...state,
      stepIndex,
      time: stepIndex * REVEAL_STEP_SECONDS,
      revealed: state.revealed + 1,
    };
  },

  isComplete(state: InverseTransformState): boolean {
    return state.revealed >= state.uniforms.length;
  },

  snapshot(state: InverseTransformState): InverseTransformSnapshot {
    const { revealed, params, xMax } = state;
    const uniforms = Array.from(state.uniforms.subarray(0, revealed));
    const samples = Array.from(state.samples.subarray(0, revealed));

    const stats = summarize(samples);
    const theoreticalMean = exponentialMean(params.rate);
    const theoreticalVariance = exponentialVariance(params.rate);

    const recent: SamplePair[] = [];
    for (let i = Math.max(0, revealed - RECENT_WINDOW); i < revealed; i += 1) {
      recent.push({ index: i, u: uniforms[i] as number, x: samples[i] as number });
    }
    const latest = recent.length > 0 ? (recent[recent.length - 1] as SamplePair) : null;

    // Enough samples that the comparison is meaningful rather than noise.
    const checksMeaningful = revealed >= 50;
    const checks: CheckResult[] = [
      checkAllFinite('All variates are finite', samples),
      checkAllNonNegative('All variates are ≥ 0', samples),
      checksMeaningful
        ? checkClose('Empirical mean ≈ 1/λ', stats.mean, theoreticalMean, 0.15)
        : {
            label: 'Empirical mean ≈ 1/λ',
            ok: false,
            detail: `needs at least 50 samples, ${revealed} revealed`,
          },
      checksMeaningful
        ? checkClose('Empirical variance ≈ 1/λ²', stats.variance, theoreticalVariance, 0.35)
        : {
            label: 'Empirical variance ≈ 1/λ²',
            ok: false,
            detail: `needs at least 50 samples, ${revealed} revealed`,
          },
    ];

    return Object.freeze({
      caseId: INVERSE_TRANSFORM_ID,
      version: INVERSE_TRANSFORM_VERSION,
      seed: state.seed,
      time: state.time,
      stepIndex: state.stepIndex,
      complete: revealed >= state.uniforms.length,

      rate: params.rate,
      sampleCount: state.uniforms.length,
      revealed,
      uniforms: revealed === 0 ? emptySnapshotArrays() : Object.freeze(uniforms),
      samples: revealed === 0 ? emptySnapshotArrays() : Object.freeze(samples),
      latest,
      recent: Object.freeze(recent),
      histogram: histogram(samples, { bins: state.binCount, min: 0, max: xMax }),
      empiricalCdf: empiricalCdf(samples, 160),
      theoreticalDensity: sampleCurve((x) => exponentialPdf(x, params.rate), 0, xMax, 140),
      theoreticalCdf: sampleCurve((x) => exponentialCdf(x, params.rate), 0, xMax, 140),
      theoretical: Object.freeze({ mean: theoreticalMean, variance: theoreticalVariance }),
      empirical: Object.freeze({
        count: stats.count,
        mean: stats.mean,
        variance: stats.variance,
        standardError: stats.standardError,
      }),
      checks: Object.freeze(checks),
      xMax,
    });
  },

  metrics(state: InverseTransformState): InverseTransformMetrics {
    const samples = state.samples.subarray(0, state.revealed);
    const stats = summarize(samples);
    return Object.freeze({
      revealed: state.revealed,
      theoreticalMean: exponentialMean(state.params.rate),
      theoreticalVariance: exponentialVariance(state.params.rate),
      empiricalMean: stats.mean,
      empiricalVariance: stats.variance,
      standardError: stats.standardError,
      maxCdfDeviation:
        state.revealed === 0
          ? NaN
          : maxCdfDeviation(samples, (x) => exponentialCdf(x, state.params.rate)),
    });
  },
});
