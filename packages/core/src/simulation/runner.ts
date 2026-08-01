import { parseParams, type SimulationConfig, type SnapshotEnvelope } from '@simulaciencia/schemas';
import { createRandomSource } from '../random/randomSource.ts';
import type { SimulationCase, SimulationMetrics, SimulationStateBase } from './case.ts';
import { planSteps } from './time.ts';

export interface RunnerInit<P extends Record<string, number>> {
  readonly seed: number;
  readonly params?: Partial<Record<keyof P, unknown>>;
}

/**
 * Owns one live simulation: its seed, its validated parameters and its state.
 *
 * This is the only mutable object in the engine, and it is deliberately not
 * reactive. A Vue component wraps it and publishes snapshots; the runner itself
 * knows nothing about rendering.
 */
export class SimulationRunner<
  P extends Record<string, number>,
  S extends SimulationStateBase,
  Snap extends SnapshotEnvelope,
  M extends SimulationMetrics,
> {
  readonly simulation: SimulationCase<P, S, Snap, M>;

  #seed: number;
  #params: P;
  #state: S;
  /** Wall-clock leftovers between `advanceBy` calls. Never affects a step. */
  #carry = 0;
  #snapshotCache: { state: S; snapshot: Snap } | null = null;

  constructor(simulation: SimulationCase<P, S, Snap, M>, init: RunnerInit<P>) {
    this.simulation = simulation;
    this.#seed = init.seed;
    this.#params = parseParams(simulation.schema, (init.params ?? {}) as Record<string, unknown>);
    this.#state = this.#createState();
  }

  #createState(): S {
    return this.simulation.createState(this.#params, createRandomSource(this.#seed));
  }

  get seed(): number {
    return this.#seed;
  }

  get params(): P {
    return this.#params;
  }

  get state(): S {
    return this.#state;
  }

  get time(): number {
    return this.#state.time;
  }

  get stepIndex(): number {
    return this.#state.stepIndex;
  }

  get complete(): boolean {
    return this.simulation.isComplete(this.#state);
  }

  /**
   * Rebuild from scratch. Passing no argument re-runs the identical simulation,
   * which is what the "reset" button must do — same seed, same picture.
   */
  reset(next: { seed?: number; params?: Partial<Record<keyof P, unknown>> } = {}): void {
    if (next.seed !== undefined) this.#seed = next.seed;
    if (next.params !== undefined) {
      this.#params = parseParams(this.simulation.schema, {
        ...this.#params,
        ...(next.params as Record<string, unknown>),
      });
    }
    this.#carry = 0;
    this.#snapshotCache = null;
    this.#state = this.#createState();
  }

  /** Execute exactly one fixed step. This is "step-by-step mode". */
  step(): void {
    if (this.complete) return;
    this.#state = this.simulation.step(this.#state);
  }

  /** Execute `count` fixed steps. */
  stepMany(count: number): number {
    let taken = 0;
    for (let i = 0; i < count && !this.complete; i += 1) {
      this.#state = this.simulation.step(this.#state);
      taken += 1;
    }
    return taken;
  }

  /**
   * Advance by a chunk of wall-clock time, in simulation seconds.
   *
   * Only whole fixed steps run; the remainder is carried. Calling this once
   * with 1.0 or a hundred times with 0.01 yields identical state — that is the
   * guarantee the `frame-independence` test pins down.
   */
  advanceBy(elapsedSeconds: number): number {
    const plan = planSteps(this.#carry + elapsedSeconds, this.simulation.fixedDt);
    this.#carry = plan.remainder;
    return this.stepMany(plan.steps);
  }

  /** Advance until simulation time reaches `targetTime`. Never rewinds. */
  advanceToTime(targetTime: number): number {
    const missing = targetTime - this.#state.time;
    if (missing <= 0) return 0;
    const plan = planSteps(missing, this.simulation.fixedDt);
    return this.stepMany(plan.steps);
  }

  /** Run to completion, with a hard cap so a bad `isComplete` cannot hang a slide. */
  runToCompletion(maxSteps = 1_000_000): number {
    return this.stepMany(maxSteps);
  }

  /** Frozen view model for the current state. Memoised per state object. */
  snapshot(): Snap {
    const cache = this.#snapshotCache;
    if (cache !== null && cache.state === this.#state) return cache.snapshot;
    const snapshot = this.simulation.snapshot(this.#state);
    this.#snapshotCache = { state: this.#state, snapshot };
    return snapshot;
  }

  metrics(): M {
    return this.simulation.metrics(this.#state);
  }

  /** The serializable identity of what is currently on screen. */
  toConfig(): SimulationConfig<P> {
    return Object.freeze({
      caseId: this.simulation.id,
      version: this.simulation.version,
      seed: this.#seed,
      params: this.#params,
      time: this.#state.time,
    });
  }
}

/**
 * Build a runner from a serializable config, optionally fast-forwarding to the
 * frozen time it records. This is the entry point used by URL-driven embeds.
 */
export function runnerFromConfig<
  P extends Record<string, number>,
  S extends SimulationStateBase,
  Snap extends SnapshotEnvelope,
  M extends SimulationMetrics,
>(
  simulation: SimulationCase<P, S, Snap, M>,
  config: SimulationConfig<P>,
): SimulationRunner<P, S, Snap, M> {
  const runner = new SimulationRunner(simulation, { seed: config.seed, params: config.params });
  if (config.time !== undefined && config.time > 0) runner.advanceToTime(config.time);
  return runner;
}
