import {
  SimulationRunner,
  type SimulationCase,
  type SimulationMetrics,
  type SimulationStateBase,
} from '@simulaciencia/core';
import type { SimulationConfig, SnapshotEnvelope } from '@simulaciencia/schemas';
import { computed, onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from 'vue';

/**
 * The single bridge between the pure engine and Vue.
 *
 * It owns the animation-frame loop and nothing else. Note what it does NOT do:
 * it never computes a statistic, never mutates a snapshot, and never lets frame
 * timing reach the simulation except as a number of seconds to advance. Every
 * component in this package consumes snapshots produced here.
 */

export interface UseSimulationOptions<P extends Record<string, number>> {
  readonly seed: number;
  readonly params?: Partial<Record<keyof P, unknown>>;
  /** Start the loop immediately on mount. */
  readonly autoplay?: boolean;
  /** Simulation seconds per real second. 1 is real time. */
  readonly speed?: number;
  /**
   * Freeze at this simulation time on creation and stay paused.
   * This is how a slide or a capture pins a deterministic frame.
   */
  readonly freezeAtTime?: number;
  /**
   * Hard ceiling on the wall time a single frame may deliver. Without it, a
   * backgrounded tab returning after a minute would try to run 3000 steps at
   * once and lock the page.
   */
  readonly maxFrameSeconds?: number;
}

export interface UseSimulation<
  P extends Record<string, number>,
  Snap extends SnapshotEnvelope,
  M extends SimulationMetrics,
> {
  readonly runner: SimulationRunner<P, SimulationStateBase, Snap, M>;
  /** Latest snapshot. Replaced, never mutated — safe to pass to any renderer. */
  readonly snapshot: ShallowRef<Snap>;
  readonly metrics: Ref<M>;
  readonly playing: Ref<boolean>;
  readonly speed: Ref<number>;
  readonly seed: Ref<number>;
  readonly complete: Ref<boolean>;
  /** Real seconds since the previous frame. Drives visual-only animation. */
  readonly frameDelta: Ref<number>;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Advance exactly one fixed step, paused. This is "step-by-step mode". */
  stepOnce(): void;
  /** Run to completion instantly. */
  finish(): void;
  reset(next?: { seed?: number; params?: Partial<Record<keyof P, unknown>> }): void;
  /** Re-run with the same parameters and a new seed. */
  resample(nextSeed: number): void;
  /** Serializable identity of what is on screen right now. */
  toConfig(): SimulationConfig<P>;
}

export function useSimulation<
  P extends Record<string, number>,
  S extends SimulationStateBase,
  Snap extends SnapshotEnvelope,
  M extends SimulationMetrics,
>(
  simulation: SimulationCase<P, S, Snap, M>,
  options: UseSimulationOptions<P>,
): UseSimulation<P, Snap, M> {
  const runner = new SimulationRunner(simulation, {
    seed: options.seed,
    ...(options.params !== undefined ? { params: options.params } : {}),
  });

  const maxFrameSeconds = options.maxFrameSeconds ?? 0.25;

  if (options.freezeAtTime !== undefined && options.freezeAtTime > 0) {
    runner.advanceToTime(options.freezeAtTime);
  }

  const snapshot = shallowRef(runner.snapshot()) as ShallowRef<Snap>;
  const metrics = ref(runner.metrics()) as Ref<M>;
  const playing = ref(false);
  const speed = ref(options.speed ?? 1);
  const seed = ref(options.seed);
  const complete = ref(runner.complete);
  const frameDelta = ref(0);

  let frameHandle: number | null = null;
  let lastTimestamp = 0;

  function publish(): void {
    snapshot.value = runner.snapshot();
    metrics.value = runner.metrics();
    complete.value = runner.complete;
  }

  function loop(timestamp: number): void {
    if (!playing.value) return;
    // First frame after play has no previous timestamp; treat it as zero
    // elapsed so pressing play can never jump the simulation forward.
    const rawDelta = lastTimestamp === 0 ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    const delta = Math.min(Math.max(0, rawDelta), maxFrameSeconds);
    frameDelta.value = delta;

    runner.advanceBy(delta * speed.value);
    publish();

    if (runner.complete) {
      pause();
      return;
    }
    frameHandle = requestAnimationFrame(loop);
  }

  function play(): void {
    if (playing.value || runner.complete) return;
    playing.value = true;
    lastTimestamp = 0;
    frameHandle = requestAnimationFrame(loop);
  }

  function pause(): void {
    playing.value = false;
    if (frameHandle !== null) {
      cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    lastTimestamp = 0;
  }

  function toggle(): void {
    if (playing.value) pause();
    else play();
  }

  function stepOnce(): void {
    pause();
    runner.step();
    publish();
  }

  function finish(): void {
    pause();
    runner.runToCompletion();
    publish();
  }

  function reset(next: { seed?: number; params?: Partial<Record<keyof P, unknown>> } = {}): void {
    pause();
    runner.reset(next);
    if (next.seed !== undefined) seed.value = next.seed;
    publish();
  }

  function resample(nextSeed: number): void {
    reset({ seed: nextSeed });
  }

  // The loop must not outlive the component. `onScopeDispose` fires for both
  // unmount and an explicitly stopped effect scope.
  onScopeDispose(() => {
    pause();
  });

  return {
    runner: runner as unknown as SimulationRunner<P, SimulationStateBase, Snap, M>,
    snapshot,
    metrics,
    playing,
    speed,
    seed,
    complete,
    frameDelta,
    play,
    pause,
    toggle,
    stepOnce,
    finish,
    reset,
    resample,
    toConfig: () => runner.toConfig(),
  };
}

/** Shared derived flag: is the component allowed to show interactive controls? */
export function useInteractive(mode: Ref<string>): Ref<boolean> {
  return computed(() => mode.value !== 'social-h' && mode.value !== 'social-v');
}
