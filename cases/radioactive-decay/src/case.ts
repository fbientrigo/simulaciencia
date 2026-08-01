import {
  checkClose,
  checkNonIncreasing,
  defineCase,
  exponentialHalfLife,
  exponentialMean,
  exponentialQuantile,
  exponentialSurvival,
  sampleCurve,
  type CheckResult,
  type CurvePoint,
  type RandomSource,
  type SimulationStateBase,
} from '@simulaciencia/core';
import type { ParamSchema, SnapshotEnvelope } from '@simulaciencia/schemas';

export const RADIOACTIVE_DECAY_ID = 'radioactive-decay';
export const RADIOACTIVE_DECAY_VERSION = '1.0.0';

/** 50 Hz fixed step. Rendering may run at any FPS; results never change. */
export const DECAY_STEP_SECONDS = 0.02;

export interface RadioactiveDecayParams extends Record<string, number> {
  /** Number of simulated objects present at t = 0. */
  initialCount: number;
  /** Decay constant λ. Each object's lifetime is Exponential(λ). */
  rate: number;
}

export const radioactiveDecaySchema: ParamSchema<RadioactiveDecayParams> = {
  initialCount: {
    kind: 'number',
    label: 'Population N₀',
    description: 'How many simulated objects start undecayed.',
    default: 400,
    min: 20,
    max: 4000,
    step: 20,
    integer: true,
  },
  rate: {
    kind: 'number',
    label: 'Decay constant λ',
    description: 'Mean lifetime is 1/λ and half-life is ln2/λ.',
    unit: 's⁻¹',
    default: 0.35,
    min: 0.05,
    max: 2,
    step: 0.05,
  },
};

/** Position inside the unit-cube chamber, already reproducible from the seed. */
export interface ParticlePlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RadioactiveDecayState extends SimulationStateBase {
  readonly params: RadioactiveDecayParams;
  readonly seed: number;
  /** One deterministic decay time per object, index-aligned with `positions`. */
  readonly decayTimes: Float64Array;
  /** The same lifetimes sorted once at init, so snapshots stay allocation-cheap. */
  readonly sortedDecayTimes: Float64Array;
  readonly positions: readonly ParticlePlacement[];
  /** Indices that crossed their decay time during the most recent step. */
  readonly justDecayed: readonly number[];
  /** Objects still undecayed at `time`. */
  readonly active: number;
  /** Time horizon used for the survival plot and for `isComplete`. */
  readonly horizon: number;
}

export interface ParticleView extends ParticlePlacement {
  readonly id: number;
  readonly decayTime: number;
  readonly alive: boolean;
}

export interface SurvivalPoint {
  readonly t: number;
  /** Fraction of the initial population still present. */
  readonly fraction: number;
}

export interface RadioactiveDecaySnapshot extends SnapshotEnvelope {
  readonly rate: number;
  readonly initialCount: number;
  readonly active: number;
  readonly decayed: number;
  readonly halfLife: number;
  readonly meanLifetime: number;
  readonly horizon: number;
  /** Renderer-independent description of every object. */
  readonly particles: readonly ParticleView[];
  /** Ids that decayed in the last step, for a one-frame visual event. */
  readonly justDecayed: readonly number[];
  /** Empirical survival curve, drawn only up to the current time. */
  readonly survivalCurve: readonly SurvivalPoint[];
  /** Closed-form `S(t) = e^{−λt}` over the whole horizon. */
  readonly theoreticalSurvival: readonly CurvePoint[];
  readonly checks: readonly CheckResult[];
}

export interface RadioactiveDecayMetrics extends Record<string, number> {
  time: number;
  active: number;
  decayed: number;
  survivingFraction: number;
  theoreticalFraction: number;
  halfLife: number;
  meanLifetime: number;
}

const SURVIVAL_GRID_POINTS = 160;

/** Count entries strictly greater than `t` in a sorted ascending array. */
function countAbove(sortedAscending: Float64Array, t: number): number {
  let lo = 0;
  let hi = sortedAscending.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sortedAscending[mid] as number) > t) hi = mid;
    else lo = mid + 1;
  }
  return sortedAscending.length - lo;
}

export const radioactiveDecayCase = defineCase<
  RadioactiveDecayParams,
  RadioactiveDecayState,
  RadioactiveDecaySnapshot,
  RadioactiveDecayMetrics
>({
  id: RADIOACTIVE_DECAY_ID,
  version: RADIOACTIVE_DECAY_VERSION,
  title: 'Population decay in a bounded chamber',
  summary:
    'Each simulated object is assigned one exponential lifetime up front; the survivor count is then a pure function of time.',
  schema: radioactiveDecaySchema,
  fixedDt: DECAY_STEP_SECONDS,

  createState(params: RadioactiveDecayParams, rng: RandomSource): RadioactiveDecayState {
    const n = Math.round(params.initialCount);

    // Two named sub-streams. Forking by label means the placement is identical
    // whether or not the lifetimes were drawn first, so a future change to one
    // does not silently reshuffle the other.
    const lifetimeRng = rng.fork('lifetimes');
    const placementRng = rng.fork('placement');

    const decayTimes = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      decayTimes[i] = lifetimeRng.nextExponential(params.rate);
    }

    const positions: ParticlePlacement[] = [];
    for (let i = 0; i < n; i += 1) {
      // Chamber is the cube [-1, 1]³; a small inset keeps objects off the walls.
      positions.push({
        x: (placementRng.nextUniform() * 2 - 1) * 0.92,
        y: (placementRng.nextUniform() * 2 - 1) * 0.92,
        z: (placementRng.nextUniform() * 2 - 1) * 0.92,
      });
    }

    const sortedDecayTimes = Float64Array.from(decayTimes);
    sortedDecayTimes.sort();

    return {
      stepIndex: 0,
      time: 0,
      params,
      seed: rng.seed,
      decayTimes,
      sortedDecayTimes,
      positions: Object.freeze(positions),
      justDecayed: Object.freeze([]),
      active: n,
      // Run long enough that survival is well under 1 %.
      horizon: exponentialQuantile(0.995, params.rate),
    };
  },

  step(state: RadioactiveDecayState): RadioactiveDecayState {
    const stepIndex = state.stepIndex + 1;
    const time = stepIndex * DECAY_STEP_SECONDS;
    const previousTime = state.time;

    // The survivor count is a pure function of time, never an accumulator.
    // This is what makes the case exactly frame-subdivision independent: no
    // amount of re-slicing the interval can change which lifetimes are ≤ t.
    const justDecayed: number[] = [];
    let active = 0;
    for (let i = 0; i < state.decayTimes.length; i += 1) {
      const decayTime = state.decayTimes[i] as number;
      if (decayTime > time) {
        active += 1;
      } else if (decayTime > previousTime) {
        justDecayed.push(i);
      }
    }

    return {
      ...state,
      stepIndex,
      time,
      active,
      justDecayed: Object.freeze(justDecayed),
    };
  },

  isComplete(state: RadioactiveDecayState): boolean {
    return state.active === 0 || state.time >= state.horizon;
  },

  snapshot(state: RadioactiveDecayState): RadioactiveDecaySnapshot {
    const { params, time, horizon } = state;
    const n = state.decayTimes.length;

    const particles: ParticleView[] = [];
    for (let i = 0; i < n; i += 1) {
      const placement = state.positions[i] as ParticlePlacement;
      particles.push({
        id: i,
        x: placement.x,
        y: placement.y,
        z: placement.z,
        decayTime: state.decayTimes[i] as number,
        alive: (state.decayTimes[i] as number) > time,
      });
    }

    const sorted = state.sortedDecayTimes;

    // Empirical curve on a fixed grid, revealed only up to the current time so
    // the 2D plot animates in step with the 3D chamber.
    const survivalCurve: SurvivalPoint[] = [];
    const gridStep = horizon / (SURVIVAL_GRID_POINTS - 1);
    for (let k = 0; k < SURVIVAL_GRID_POINTS; k += 1) {
      const t = k * gridStep;
      if (t > time) break;
      survivalCurve.push({ t, fraction: n === 0 ? 0 : countAbove(sorted, t) / n });
    }
    // Always pin the curve to "now" so its head tracks the chamber exactly.
    survivalCurve.push({ t: time, fraction: n === 0 ? 0 : state.active / n });

    const theoreticalFraction = exponentialSurvival(time, params.rate);
    const checks: CheckResult[] = [
      checkNonIncreasing(
        'Survivors never increase',
        survivalCurve.map((p) => p.fraction),
      ),
      time > 0
        ? checkClose(
            'Survival fraction ≈ e^(−λt)',
            n === 0 ? 0 : state.active / n,
            theoreticalFraction,
            0.2,
          )
        : { label: 'Survival fraction ≈ e^(−λt)', ok: true, detail: 'trivially 1 at t = 0' },
    ];

    return Object.freeze({
      caseId: RADIOACTIVE_DECAY_ID,
      version: RADIOACTIVE_DECAY_VERSION,
      seed: state.seed,
      time,
      stepIndex: state.stepIndex,
      complete: state.active === 0 || time >= horizon,

      rate: params.rate,
      initialCount: n,
      active: state.active,
      decayed: n - state.active,
      halfLife: exponentialHalfLife(params.rate),
      meanLifetime: exponentialMean(params.rate),
      horizon,
      particles: Object.freeze(particles),
      justDecayed: state.justDecayed,
      survivalCurve: Object.freeze(survivalCurve),
      theoreticalSurvival: sampleCurve((t) => exponentialSurvival(t, params.rate), 0, horizon, 160),
      checks: Object.freeze(checks),
    });
  },

  metrics(state: RadioactiveDecayState): RadioactiveDecayMetrics {
    const n = state.decayTimes.length;
    return Object.freeze({
      time: state.time,
      active: state.active,
      decayed: n - state.active,
      survivingFraction: n === 0 ? 0 : state.active / n,
      theoreticalFraction: exponentialSurvival(state.time, state.params.rate),
      halfLife: exponentialHalfLife(state.params.rate),
      meanLifetime: exponentialMean(state.params.rate),
    });
  },
});
