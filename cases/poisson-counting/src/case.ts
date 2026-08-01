import {
  defineCase,
  mean as sampleMean,
  variance as sampleVariance,
  type CheckResult,
  type RandomSource,
  type SimulationStateBase,
} from '@simulaciencia/core';
import type { ParamSchema, SnapshotEnvelope } from '@simulaciencia/schemas';
import { poissonPmf, poissonSupportMax, poissonTailAbove } from './poisson.ts';

export const POISSON_COUNTING_ID = 'poisson-counting';
export const POISSON_COUNTING_VERSION = '1.0.0';

/**
 * Pedagogical playback time, NOT the physical observation window.
 *
 * One fixed step reveals exactly one precomputed observation window, so four
 * windows appear per real second at speed 1 — slow enough to narrate, fast
 * enough to fill a histogram during a lecture. The physical exposure is a
 * separate quantity, `revealedWindows × windowDuration`, reported by the
 * snapshot as `totalExposure`.
 */
export const POISSON_STEP_SECONDS = 0.25;

/**
 * Half-extent of the detector volume along every axis.
 *
 * Interaction positions are normalized into `[-0.9, 0.9]³`, which is the cube
 * `[-1, 1]³` with a small inset so an event never lands exactly on a wall.
 * The renderer is free to scale this however it likes; the contract is only
 * that the numbers stay inside these documented bounds.
 */
export const DETECTOR_HALF_EXTENT = 0.9;

/**
 * Fewest observed windows before the diagnostics panel claims anything.
 *
 * Below this, the unbiased variance of a Poisson sample is so noisy that the
 * Fano factor routinely lands outside [0.5, 1.5] for a perfectly correct
 * generator, and a student would read a correct simulation as broken.
 */
export const MIN_DIAGNOSTIC_WINDOWS = 30;

/**
 * Hard cap on arrivals drawn inside a single window.
 *
 * The loop is guaranteed to terminate mathematically (waiting times are
 * strictly positive), but a guard costs nothing and keeps a pathological
 * parameter set from freezing a slide instead of merely looking wrong.
 */
const MAX_ARRIVALS_PER_WINDOW = 5000;

export interface PoissonCountingParams extends Record<string, number> {
  /** λ — expected events per unit of physical time. */
  rate: number;
  /** Δt — duration of one observation window, in the same physical time unit. */
  windowDuration: number;
  /** How many observation windows are precomputed and available to reveal. */
  maxWindows: number;
}

/*
 * Bounds are chosen so that μ = rate × windowDuration stays at or below 20.
 * Beyond that the discrete histogram needs more bars than a projected slide can
 * carry, and the lesson's "the distribution appears" moment stops being legible
 * from the back of a room.
 */
export const poissonCountingSchema: ParamSchema<PoissonCountingParams> = {
  rate: {
    kind: 'number',
    label: 'Tasa λ',
    description: 'Eventos esperados por unidad de tiempo físico.',
    unit: 'eventos/u.t.',
    default: 3,
    min: 0.2,
    max: 10,
    step: 0.1,
  },
  windowDuration: {
    kind: 'number',
    label: 'Duración de la ventana Δt',
    description: 'Cada ventana de observación dura Δt unidades de tiempo físico.',
    unit: 'u.t.',
    default: 1,
    min: 0.2,
    max: 2,
    step: 0.1,
  },
  maxWindows: {
    kind: 'number',
    label: 'Ventanas disponibles',
    description: 'Número de ventanas precalculadas que se pueden revelar.',
    default: 600,
    min: 20,
    max: 2000,
    step: 10,
    integer: true,
  },
};

/** One detected event: when it arrived, and where inside the detector volume. */
export interface DetectorEvent {
  /** Index of the event inside its own window, starting at 0. */
  readonly id: number;
  /** Arrival time measured from the start of the window, in `[0, Δt]`. */
  readonly arrivalTime: number;
  /** `arrivalTime / Δt`, in `[0, 1]`. Convenient for animation. */
  readonly phase: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One complete observation of the counting experiment. */
export interface ObservationWindow {
  readonly index: number;
  /** K — a non-negative integer, equal to `events.length`. */
  readonly count: number;
  readonly events: readonly DetectorEvent[];
}

export interface PoissonCountingState extends SimulationStateBase {
  readonly params: PoissonCountingParams;
  readonly seed: number;
  /** Every window, precomputed in `createState`. Stepping only reveals them. */
  readonly windows: readonly ObservationWindow[];
  /** How many of `windows` the student has observed so far. Monotonic. */
  readonly revealedWindows: number;
}

/** One bar of the discrete chart: what was observed and what theory predicts. */
export interface CountBin {
  /** The count this bar stands for. For the overflow bar, the first value it absorbs. */
  readonly k: number;
  /** Axis label. Numeric for ordinary bars, `≥ n` for the overflow bar. */
  readonly label: string;
  /** Observed windows with this count. */
  readonly count: number;
  /** `count / revealedWindows`. Zero before anything is observed. */
  readonly frequency: number;
  /** Theoretical `P(K = k)`, or the aggregated tail for the overflow bar. */
  readonly probability: number;
  readonly overflow: boolean;
}

export interface PmfPoint {
  readonly k: number;
  readonly probability: number;
}

export interface PoissonCountingSnapshot extends SnapshotEnvelope {
  readonly rate: number;
  readonly windowDuration: number;
  /** μ = λ Δt — the expected count in one window. */
  readonly expectedCount: number;

  readonly maxWindows: number;
  readonly revealedWindows: number;
  /** Physical time actually observed: `revealedWindows × Δt`. */
  readonly totalExposure: number;

  /** K of the most recently revealed window; 0 before anything is revealed. */
  readonly currentCount: number;
  /** The events of that same window. Empty before anything is revealed. */
  readonly currentEvents: readonly DetectorEvent[];
  /** Every revealed count, in the order observed. */
  readonly countHistory: readonly number[];

  /** Stable chart support `0 … kMax`, derived from μ and never from the sample. */
  readonly support: readonly number[];
  /** Empirical bars plus, when the tail is non-empty, one overflow bar. */
  readonly histogram: readonly CountBin[];
  /** Theoretical PMF on `support`. */
  readonly pmf: readonly PmfPoint[];
  /** `P(K > max(support))`. Zero when the support already covers everything. */
  readonly pmfOverflow: number;

  /*
   * The three diagnostics below are plain finite numbers, never `NaN`.
   *
   * `NaN` would survive `JSON.stringify` only as `null`, which would break the
   * round-trip guarantee this snapshot makes. Undefined estimators report `0`
   * instead, and `revealedWindows` — not the value — is what tells a reader
   * whether the number means anything: the mean is undefined below one window,
   * the variance and the Fano factor below two, and neither is worth reading
   * below `minimumDiagnosticWindows`.
   */
  readonly empiricalMean: number;
  /** Unbiased (n − 1) sample variance. */
  readonly empiricalVariance: number;
  /** Var/mean. Exactly one for a Poisson process. */
  readonly fanoFactor: number;
  /** False while too few windows exist for the diagnostics to mean anything. */
  readonly diagnosticsReady: boolean;
  readonly expectedMean: number;
  readonly expectedVariance: number;
  readonly minimumDiagnosticWindows: number;

  /** Spanish pass/fail statements, rendered verbatim in the diagnostics panel. */
  readonly checks: readonly CheckResult[];
}

export interface PoissonCountingMetrics extends Record<string, number> {
  time: number;
  revealedWindows: number;
  totalExposure: number;
  currentCount: number;
  expectedCount: number;
  empiricalMean: number;
  empiricalVariance: number;
  fanoFactor: number;
}

function formatNumber(value: number, digits = 3): string {
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(digits);
}

/**
 * A pass/fail statement with Spanish wording.
 *
 * `checkClose` from core would do the arithmetic, but its `detail` string is
 * English and this panel is learner-visible. The comparison itself is the same
 * fixed-threshold, seed-stable form used everywhere else in the project.
 */
function closeEnough(
  label: string,
  observed: number,
  expected: number,
  tolerance: number,
): CheckResult {
  const error = Math.abs(observed - expected);
  return {
    label,
    ok: Number.isFinite(error) && error <= tolerance,
    detail: `observado ${formatNumber(observed)} · esperado ${formatNumber(expected)} · error ${formatNumber(error)} · tolerancia ${formatNumber(tolerance)}`,
  };
}

/**
 * Draw one observation window from exponential inter-arrival times.
 *
 * This is the whole scientific claim of the case: no Poisson sampler is called
 * anywhere. Waiting times `E_i ~ Exponential(λ)` are accumulated until the next
 * arrival would fall outside the window, and the number of arrivals that fit is
 * the Poisson count. The counts are a CONSEQUENCE of the exponential draws,
 * which is exactly the connection slide 9 makes explicit.
 */
function generateWindow(
  index: number,
  params: PoissonCountingParams,
  rng: RandomSource,
): ObservationWindow {
  // Two independent forks per window. The counts come from `:arrivals` only,
  // so changing how events are placed in space — a different visual layout, a
  // different detector shape — provably cannot move a single count.
  const arrivalRng = rng.fork(`window:${index}:arrivals`);
  const positionRng = rng.fork(`window:${index}:positions`);

  const arrivals: number[] = [];
  let elapsed = 0;
  for (let i = 0; i < MAX_ARRIVALS_PER_WINDOW; i += 1) {
    elapsed += arrivalRng.nextExponential(params.rate);
    if (elapsed > params.windowDuration) break;
    arrivals.push(elapsed);
  }

  const events: DetectorEvent[] = arrivals.map((arrivalTime, id) => ({
    id,
    arrivalTime,
    phase: params.windowDuration === 0 ? 0 : arrivalTime / params.windowDuration,
    x: (positionRng.nextUniform() * 2 - 1) * DETECTOR_HALF_EXTENT,
    y: (positionRng.nextUniform() * 2 - 1) * DETECTOR_HALF_EXTENT,
    z: (positionRng.nextUniform() * 2 - 1) * DETECTOR_HALF_EXTENT,
  }));

  return Object.freeze({
    index,
    count: events.length,
    events: Object.freeze(events),
  });
}

export const poissonCountingCase = defineCase<
  PoissonCountingParams,
  PoissonCountingState,
  PoissonCountingSnapshot,
  PoissonCountingMetrics
>({
  id: POISSON_COUNTING_ID,
  version: POISSON_COUNTING_VERSION,
  title: 'Conteos aleatorios y distribución de Poisson',
  summary:
    'Cada ventana de observación produce un entero: el número de eventos que llegaron. Los tiempos entre llegadas son exponenciales; los conteos resultan ser de Poisson.',
  schema: poissonCountingSchema,
  fixedDt: POISSON_STEP_SECONDS,

  createState(params: PoissonCountingParams, rng: RandomSource): PoissonCountingState {
    const total = Math.round(params.maxWindows);
    const windows: ObservationWindow[] = [];
    for (let i = 0; i < total; i += 1) {
      windows.push(generateWindow(i, params, rng));
    }

    return {
      stepIndex: 0,
      time: 0,
      params,
      seed: rng.seed,
      windows: Object.freeze(windows),
      revealedWindows: 0,
    };
  },

  /** One step reveals exactly one already-computed observation window. */
  step(state: PoissonCountingState): PoissonCountingState {
    const stepIndex = state.stepIndex + 1;
    return {
      ...state,
      stepIndex,
      // Never accumulated: time is an integer step count times a constant.
      time: stepIndex * POISSON_STEP_SECONDS,
      revealedWindows: Math.min(state.windows.length, state.revealedWindows + 1),
    };
  },

  isComplete(state: PoissonCountingState): boolean {
    return state.revealedWindows >= state.windows.length;
  },

  snapshot(state: PoissonCountingState): PoissonCountingSnapshot {
    const { params, revealedWindows } = state;
    const mu = params.rate * params.windowDuration;

    const countHistory: number[] = [];
    for (let i = 0; i < revealedWindows; i += 1) {
      countHistory.push((state.windows[i] as ObservationWindow).count);
    }

    const current = revealedWindows > 0 ? state.windows[revealedWindows - 1] : undefined;

    const kMax = poissonSupportMax(mu);
    const support: number[] = [];
    for (let k = 0; k <= kMax; k += 1) support.push(k);

    const pmfValues = poissonPmf(mu, kMax);
    const pmfOverflow = poissonTailAbove(pmfValues);

    const observed = new Array<number>(kMax + 1).fill(0);
    let observedOverflow = 0;
    for (const count of countHistory) {
      if (count <= kMax) observed[count] = (observed[count] as number) + 1;
      else observedOverflow += 1;
    }

    const denominator = revealedWindows === 0 ? 1 : revealedWindows;
    const histogram: CountBin[] = support.map((k) => ({
      k,
      label: String(k),
      count: observed[k] as number,
      frequency: (observed[k] as number) / denominator,
      probability: pmfValues[k] as number,
      overflow: false,
    }));

    // The overflow bar earns its place only when either theory or the sample
    // actually puts mass beyond the support. A permanent empty bar would just
    // be a confusing gap at the right edge of every chart.
    if (observedOverflow > 0 || pmfOverflow > 1e-6) {
      histogram.push({
        k: kMax + 1,
        label: `≥ ${kMax + 1}`,
        count: observedOverflow,
        frequency: observedOverflow / denominator,
        probability: pmfOverflow,
        overflow: true,
      });
    }

    const empiricalMean = revealedWindows === 0 ? 0 : sampleMean(countHistory);
    const empiricalVariance = revealedWindows < 2 ? 0 : sampleVariance(countHistory);
    const fanoFactor =
      revealedWindows < 2 || empiricalMean <= 0 ? 0 : empiricalVariance / empiricalMean;
    const diagnosticsReady = revealedWindows >= MIN_DIAGNOSTIC_WINDOWS;

    // Tolerances scale with the Monte Carlo error of the estimator itself, so
    // the panel stays honest at 30 windows and at 2000 without hand-tuning.
    const meanTolerance = 4 * Math.sqrt(mu / Math.max(1, revealedWindows));
    const varianceTolerance = 4 * mu * Math.sqrt(2 / Math.max(1, revealedWindows - 1));
    const fanoTolerance = 4 * Math.sqrt(2 / Math.max(1, revealedWindows - 1));

    const checks: CheckResult[] = diagnosticsReady
      ? [
          closeEnough('Media empírica ≈ μ', empiricalMean, mu, meanTolerance),
          closeEnough('Varianza empírica ≈ μ', empiricalVariance, mu, varianceTolerance),
          closeEnough('Factor de Fano ≈ 1', fanoFactor, 1, fanoTolerance),
        ]
      : [
          {
            label: 'Observaciones suficientes',
            ok: false,
            detail: `se necesitan al menos ${MIN_DIAGNOSTIC_WINDOWS} ventanas; hay ${revealedWindows}`,
          },
        ];

    return Object.freeze({
      caseId: POISSON_COUNTING_ID,
      version: POISSON_COUNTING_VERSION,
      seed: state.seed,
      time: state.time,
      stepIndex: state.stepIndex,
      complete: revealedWindows >= state.windows.length,

      rate: params.rate,
      windowDuration: params.windowDuration,
      expectedCount: mu,

      maxWindows: state.windows.length,
      revealedWindows,
      totalExposure: revealedWindows * params.windowDuration,

      currentCount: current?.count ?? 0,
      currentEvents: current?.events ?? Object.freeze([]),
      countHistory: Object.freeze(countHistory),

      support: Object.freeze(support),
      histogram: Object.freeze(histogram),
      pmf: Object.freeze(support.map((k) => ({ k, probability: pmfValues[k] as number }))),
      pmfOverflow,

      empiricalMean,
      empiricalVariance,
      fanoFactor,
      diagnosticsReady,
      expectedMean: mu,
      expectedVariance: mu,
      minimumDiagnosticWindows: MIN_DIAGNOSTIC_WINDOWS,

      checks: Object.freeze(checks),
    });
  },

  metrics(state: PoissonCountingState): PoissonCountingMetrics {
    const { params, revealedWindows } = state;
    const mu = params.rate * params.windowDuration;

    const counts: number[] = [];
    for (let i = 0; i < revealedWindows; i += 1) {
      counts.push((state.windows[i] as ObservationWindow).count);
    }

    const empiricalMean = revealedWindows === 0 ? 0 : sampleMean(counts);
    const empiricalVariance = revealedWindows < 2 ? 0 : sampleVariance(counts);
    const current =
      revealedWindows > 0 ? (state.windows[revealedWindows - 1] as ObservationWindow) : undefined;

    return Object.freeze({
      time: state.time,
      revealedWindows,
      totalExposure: revealedWindows * params.windowDuration,
      currentCount: current?.count ?? 0,
      expectedCount: mu,
      empiricalMean,
      empiricalVariance,
      fanoFactor: revealedWindows < 2 || empiricalMean <= 0 ? 0 : empiricalVariance / empiricalMean,
    });
  },
});
