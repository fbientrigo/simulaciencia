/**
 * Fixed-timestep bookkeeping.
 *
 * Simulation time is never accumulated as a float. It is always
 * `stepIndex * fixedDt`, an integer count times a constant. Wall-clock elapsed
 * time only ever decides *how many* steps to run, never what a step does.
 * That is the whole of the "results are independent from rendering FPS" rule.
 */

export interface StepPlan {
  /** Whole fixed steps to execute now. */
  readonly steps: number;
  /** Wall time left over, to be carried into the next call. */
  readonly remainder: number;
}

/**
 * Decide how many fixed steps a chunk of elapsed wall time buys.
 *
 * The epsilon matters: advancing 1 s at once gives `1 / 0.01 = 99.999…`, while
 * a hundred 10 ms calls accumulate to `1.0000000000000007`. Without the nudge
 * those two paths would take 99 and 100 steps and produce different results,
 * which is exactly the bug the frame-independence test guards against.
 */
export function planSteps(elapsed: number, fixedDt: number, maxSteps = 100_000): StepPlan {
  if (!(fixedDt > 0) || !Number.isFinite(fixedDt)) {
    throw new Error(`fixedDt must be a positive finite number, received ${fixedDt}.`);
  }
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return { steps: 0, remainder: Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0 };
  }
  const epsilon = fixedDt * 1e-9;
  const exact = (elapsed + epsilon) / fixedDt;
  const steps = Math.min(maxSteps, Math.floor(exact));
  const remainder = Math.max(0, elapsed - steps * fixedDt);
  return { steps, remainder };
}

/** Exact simulation time for a step index. Never drifts. */
export function timeAtStep(stepIndex: number, fixedDt: number): number {
  return stepIndex * fixedDt;
}
