import type { ParamSchema, SnapshotEnvelope } from '@simulaciencia/schemas';
import type { RandomSource } from '../random/randomSource.ts';

/**
 * Every case state carries the fixed-step clock. The runner owns advancing it;
 * a case only has to copy these two fields forward in `step`.
 */
export interface SimulationStateBase {
  readonly stepIndex: number;
  /** Always `stepIndex * fixedDt`. Never accumulated. */
  readonly time: number;
}

/** Derived scalars a case exposes for tables, checks and captions. */
export type SimulationMetrics = Readonly<Record<string, number>>;

/**
 * The contract every scientific case implements.
 *
 * Rules enforced by review and by `no-forbidden-imports.test.ts`:
 *  - no Vue, Three.js, DOM or Slidev import may appear in an implementation;
 *  - `createState` must draw all randomness from `rng` and nothing else;
 *  - `step` must be pure: same input state ⇒ same output state;
 *  - `snapshot` must return a frozen, JSON-serializable value.
 */
export interface SimulationCase<
  P extends Record<string, number>,
  S extends SimulationStateBase,
  Snap extends SnapshotEnvelope,
  M extends SimulationMetrics,
> {
  /** Stable identifier used in URLs and in the config envelope. */
  readonly id: string;
  /** Contract version. Bump when `params` or the snapshot shape breaks. */
  readonly version: string;
  readonly title: string;
  /** One sentence, shown as the caption in the gallery and on slides. */
  readonly summary: string;
  readonly schema: ParamSchema<P>;
  /** Fixed step in simulation seconds. Rendering never changes this. */
  readonly fixedDt: number;

  /** Deterministic initialisation. All randomness comes from `rng`. */
  createState(params: P, rng: RandomSource): S;

  /** Advance exactly one fixed step. Pure. */
  step(state: S): S;

  /** Frozen, renderer-independent, JSON-serializable view model. */
  snapshot(state: S): Snap;

  /** Derived scalars. Cheap enough to call every frame. */
  metrics(state: S): M;

  /** True when further stepping can no longer change the snapshot. */
  isComplete(state: S): boolean;
}

/** Convenience alias for a case whose generics do not matter to the caller. */
export type AnySimulationCase = SimulationCase<
  Record<string, number>,
  SimulationStateBase,
  SnapshotEnvelope,
  SimulationMetrics
>;

/** Helper preserving inference while asserting the contract at author time. */
export function defineCase<
  P extends Record<string, number>,
  S extends SimulationStateBase,
  Snap extends SnapshotEnvelope,
  M extends SimulationMetrics,
>(definition: SimulationCase<P, S, Snap, M>): SimulationCase<P, S, Snap, M> {
  return Object.freeze(definition);
}
