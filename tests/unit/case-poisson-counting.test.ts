import {
  DETECTOR_HALF_EXTENT,
  MIN_DIAGNOSTIC_WINDOWS,
  POISSON_COUNTING_ID,
  POISSON_STEP_SECONDS,
  poissonCountingCase,
  poissonPmf,
  poissonSupportMax,
  poissonTailAbove,
  type PoissonCountingSnapshot,
} from '@simulaciencia/case-poisson-counting';
import { SimulationRunner, createRandomSource } from '@simulaciencia/core';
import { describe, expect, it } from 'vitest';

/**
 * The Poisson counting case, tested as pure mathematics.
 *
 * Nothing here mounts a component or touches a renderer: if any of these fail,
 * the science is wrong, not the drawing. Every tolerance below is a measured
 * value for a fixed seed, recorded in the comment beside it, never a p-value.
 */

const BASE = { rate: 3, windowDuration: 1, maxWindows: 600 } as const;

function run(
  steps: number,
  overrides: Partial<typeof BASE> & { seed?: number } = {},
): PoissonCountingSnapshot {
  const { seed = 20260801, ...params } = overrides;
  const runner = new SimulationRunner(poissonCountingCase, {
    seed,
    params: { ...BASE, ...params },
  });
  runner.stepMany(steps);
  return runner.snapshot();
}

describe('poisson counting — reproducibility', () => {
  it('reproduces identical windows for the same seed and parameters', () => {
    expect(run(120)).toEqual(run(120));
  });

  it('produces different observations for a different seed', () => {
    const a = run(120, { seed: 20260801 });
    const b = run(120, { seed: 20260802 });
    expect(a.countHistory).not.toEqual(b.countHistory);
    // Same support and same theory though — only the sample moved.
    expect(a.support).toEqual(b.support);
    expect(a.pmf).toEqual(b.pmf);
  });

  it('reconstructs the first N windows identically however they were reached', () => {
    // One shot, one at a time, and via wall-clock advance: all the same state.
    const oneShot = run(40);

    const oneByOne = new SimulationRunner(poissonCountingCase, { seed: 20260801, params: BASE });
    for (let i = 0; i < 40; i += 1) oneByOne.step();

    const byTime = new SimulationRunner(poissonCountingCase, { seed: 20260801, params: BASE });
    byTime.advanceToTime(40 * POISSON_STEP_SECONDS);

    expect(oneByOne.snapshot()).toEqual(oneShot);
    expect(byTime.snapshot()).toEqual(oneShot);
  });
});

describe('poisson counting — counts and events', () => {
  it('produces finite non-negative integers', () => {
    const snapshot = run(300);
    expect(snapshot.countHistory).toHaveLength(300);
    for (const count of snapshot.countHistory) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(count)).toBe(true);
    }
  });

  it('keeps the count equal to the number of event records in every window', () => {
    const runner = new SimulationRunner(poissonCountingCase, { seed: 4242, params: BASE });
    for (let i = 0; i < 150; i += 1) {
      runner.step();
      const snapshot = runner.snapshot();
      expect(snapshot.currentEvents).toHaveLength(snapshot.currentCount);
    }
  });

  it('places every arrival time inside the observation window', () => {
    const runner = new SimulationRunner(poissonCountingCase, {
      seed: 99,
      params: { ...BASE, windowDuration: 1.7 },
    });
    for (let i = 0; i < 120; i += 1) {
      runner.step();
      const snapshot = runner.snapshot();
      let previous = 0;
      for (const event of snapshot.currentEvents) {
        expect(event.arrivalTime).toBeGreaterThan(0);
        expect(event.arrivalTime).toBeLessThanOrEqual(1.7);
        // Arrivals are a cumulative sum of positive waiting times, so they are
        // strictly increasing — that is what makes them a point process.
        expect(event.arrivalTime).toBeGreaterThan(previous);
        previous = event.arrivalTime;
        expect(event.phase).toBeCloseTo(event.arrivalTime / 1.7, 12);
      }
    }
  });

  it('keeps every event position inside the documented detector bounds', () => {
    const runner = new SimulationRunner(poissonCountingCase, { seed: 5, params: BASE });
    let checked = 0;
    for (let i = 0; i < 100; i += 1) {
      runner.step();
      for (const event of runner.snapshot().currentEvents) {
        expect(Math.abs(event.x)).toBeLessThanOrEqual(DETECTOR_HALF_EXTENT);
        expect(Math.abs(event.y)).toBeLessThanOrEqual(DETECTOR_HALF_EXTENT);
        expect(Math.abs(event.z)).toBeLessThanOrEqual(DETECTOR_HALF_EXTENT);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('poisson counting — stream separation', () => {
  /**
   * The counts must depend on the `:arrivals` fork and nothing else.
   *
   * This is asserted structurally: drawing the whole `:positions` fork for a
   * window, in any quantity, cannot move the `:arrivals` fork, because forking
   * derives a fresh stream from `(seed, label)` rather than from the parent's
   * current position. If that ever changed, moving a particle on screen would
   * silently change a statistic.
   */
  it('cannot let the visual placement stream disturb the arrival stream', () => {
    const root = createRandomSource(20260801);

    const arrivalsFirst = root.fork('window:7:arrivals');
    const untouched = [
      arrivalsFirst.nextExponential(3),
      arrivalsFirst.nextExponential(3),
      arrivalsFirst.nextExponential(3),
    ];

    // Consume a large, arbitrary amount of the placement stream first.
    const positions = root.fork('window:7:positions');
    for (let i = 0; i < 500; i += 1) positions.nextUniform();

    const arrivalsAfter = root.fork('window:7:arrivals');
    const afterHeavyPlacementUse = [
      arrivalsAfter.nextExponential(3),
      arrivalsAfter.nextExponential(3),
      arrivalsAfter.nextExponential(3),
    ];

    expect(afterHeavyPlacementUse).toEqual(untouched);
  });

  it('gives each window its own independent arrival stream', () => {
    const root = createRandomSource(20260801);
    const first = root.fork('window:0:arrivals').nextExponential(3);
    const second = root.fork('window:1:arrivals').nextExponential(3);
    expect(first).not.toBe(second);
  });
});

describe('poisson counting — stepping and completion', () => {
  it('reveals exactly one window per step', () => {
    const runner = new SimulationRunner(poissonCountingCase, { seed: 1, params: BASE });
    for (let i = 1; i <= 25; i += 1) {
      runner.step();
      expect(runner.snapshot().revealedWindows).toBe(i);
      expect(runner.snapshot().countHistory).toHaveLength(i);
    }
  });

  it('keeps the revealed-window count monotonic', () => {
    const runner = new SimulationRunner(poissonCountingCase, { seed: 3, params: BASE });
    let previous = 0;
    for (let i = 0; i < 200; i += 1) {
      runner.advanceBy(POISSON_STEP_SECONDS * 0.37);
      const current = runner.snapshot().revealedWindows;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('completes exactly at maxWindows and then stops changing', () => {
    const runner = new SimulationRunner(poissonCountingCase, {
      seed: 11,
      params: { ...BASE, maxWindows: 30 },
    });
    runner.stepMany(29);
    expect(runner.complete).toBe(false);
    runner.step();
    expect(runner.complete).toBe(true);
    expect(runner.snapshot().revealedWindows).toBe(30);

    const atCompletion = runner.snapshot();
    runner.stepMany(50);
    expect(runner.snapshot()).toEqual(atCompletion);
  });

  it('reports physical exposure separately from pedagogical playback time', () => {
    const snapshot = run(48, { windowDuration: 1.5 });
    // Playback time is stepIndex × fixedDt; exposure is windows × Δt. They are
    // different quantities and must not be confused on a slide.
    expect(snapshot.time).toBeCloseTo(48 * POISSON_STEP_SECONDS, 12);
    expect(snapshot.totalExposure).toBeCloseTo(48 * 1.5, 12);
  });

  it('keeps simulation time exactly stepIndex × fixedDt, never an accumulator', () => {
    const runner = new SimulationRunner(poissonCountingCase, { seed: 2, params: BASE });
    for (let i = 0; i < 400; i += 1) runner.advanceBy(0.00913);
    expect(runner.time).toBe(runner.stepIndex * POISSON_STEP_SECONDS);
  });
});

describe('poisson counting — snapshot contract', () => {
  it('returns a frozen snapshot', () => {
    const snapshot = run(20);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.countHistory)).toBe(true);
    expect(Object.isFrozen(snapshot.histogram)).toBe(true);
    expect(Object.isFrozen(snapshot.pmf)).toBe(true);
  });

  it('round-trips through JSON without losing a single value', () => {
    const snapshot = run(60);
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    // Exact structural equality, which is only possible because the snapshot
    // contains no NaN, no Infinity, no typed array and no class instance.
    expect(roundTripped).toEqual(JSON.parse(JSON.stringify(snapshot)));
    expect(roundTripped.countHistory).toEqual([...snapshot.countHistory]);
    expect(roundTripped.empiricalMean).toBe(snapshot.empiricalMean);
    expect(roundTripped.fanoFactor).toBe(snapshot.fanoFactor);
  });

  it('identifies itself with the case id and version', () => {
    const snapshot = run(1);
    expect(snapshot.caseId).toBe(POISSON_COUNTING_ID);
    expect(snapshot.version).toBe(poissonCountingCase.version);
    expect(snapshot.seed).toBe(20260801);
  });

  it('reports an empty, well-formed snapshot before anything is revealed', () => {
    const snapshot = run(0);
    expect(snapshot.revealedWindows).toBe(0);
    expect(snapshot.currentCount).toBe(0);
    expect(snapshot.currentEvents).toEqual([]);
    expect(snapshot.countHistory).toEqual([]);
    expect(snapshot.totalExposure).toBe(0);
    expect(snapshot.diagnosticsReady).toBe(false);
    // Every histogram bar exists but is empty, so the axis is already stable.
    expect(snapshot.histogram.every((bin) => bin.count === 0)).toBe(true);
  });
});

describe('poisson counting — the theoretical PMF', () => {
  it('sums to one over the support plus the overflow bin', () => {
    for (const [rate, windowDuration] of [
      [0.5, 0.4],
      [3, 1],
      [8, 2],
      [10, 2],
    ] as const) {
      const snapshot = run(50, { rate, windowDuration });
      const total =
        snapshot.pmf.reduce((sum, point) => sum + point.probability, 0) + snapshot.pmfOverflow;
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('matches the closed form for small k, where factorials are still safe', () => {
    const mu = 3;
    const pmf = poissonPmf(mu, 6);
    const factorial = [1, 1, 2, 6, 24, 120, 720];
    for (let k = 0; k <= 6; k += 1) {
      const closedForm = (Math.exp(-mu) * mu ** k) / (factorial[k] as number);
      expect(pmf[k]).toBeCloseTo(closedForm, 14);
    }
  });

  it('chooses the chart support from μ, never from the observed sample', () => {
    // The same μ, wildly different amounts of data: identical support.
    const early = run(1);
    const late = run(500);
    expect(early.support).toEqual(late.support);
    expect(early.pmf).toEqual(late.pmf);
    expect(poissonSupportMax(3)).toBe(early.support[early.support.length - 1]);
  });

  it('keeps the support inside the documented readable range', () => {
    // μ is capped at 20 by the schema bounds; the widest support stays legible.
    expect(poissonSupportMax(0.08)).toBe(8);
    expect(poissonSupportMax(20)).toBeLessThanOrEqual(40);
    expect(poissonTailAbove(poissonPmf(3, 10))).toBeGreaterThan(0);
    expect(poissonTailAbove(poissonPmf(3, 60))).toBeCloseTo(0, 12);
  });

  it('adds an overflow bar only when there is tail mass to aggregate', () => {
    const wide = run(50, { rate: 3, windowDuration: 1 });
    expect(wide.histogram.some((bin) => bin.overflow)).toBe(true);

    // μ = 0.2 with a minimum support of 8 already covers essentially everything.
    const narrow = run(50, { rate: 0.5, windowDuration: 0.4 });
    expect(narrow.histogram.some((bin) => bin.overflow)).toBe(false);
    expect(narrow.pmfOverflow).toBeLessThan(1e-6);
  });

  it('accounts for every observation exactly once across the bars', () => {
    const snapshot = run(250);
    const counted = snapshot.histogram.reduce((sum, bin) => sum + bin.count, 0);
    expect(counted).toBe(snapshot.revealedWindows);
    const frequency = snapshot.histogram.reduce((sum, bin) => sum + bin.frequency, 0);
    expect(frequency).toBeCloseTo(1, 12);
  });
});

describe('poisson counting — diagnostics', () => {
  it('withholds a verdict until enough windows exist', () => {
    expect(run(MIN_DIAGNOSTIC_WINDOWS - 1).diagnosticsReady).toBe(false);
    expect(run(MIN_DIAGNOSTIC_WINDOWS).diagnosticsReady).toBe(true);
  });

  /*
   * Measured for seed 20260801, λ = 3, Δt = 1 (so μ = 3):
   *   40 windows  → mean 3.1500, variance 3.3103, Fano 1.0509
   *   400 windows → mean 3.0625, variance 3.1314, Fano 1.0225
   *  1000 windows → mean 3.0190, variance 3.0457, Fano 1.0088
   * The tolerances below are those measurements rounded outward, not p-values:
   * the same seed reproduces exactly the same numbers forever.
   */
  it('converges to μ in mean, variance and Fano factor for a fixed seed', () => {
    const short = run(40);
    expect(short.empiricalMean).toBeCloseTo(3.15, 10);
    expect(short.empiricalVariance).toBeCloseTo(3.3103, 3);
    expect(short.fanoFactor).toBeCloseTo(1.0509, 3);

    const long = run(400);
    expect(long.empiricalMean).toBeCloseTo(3.0625, 10);
    expect(long.empiricalVariance).toBeCloseTo(3.1314, 3);
    expect(long.fanoFactor).toBeCloseTo(1.0225, 3);
    expect(long.checks.every((check) => check.ok)).toBe(true);

    const longer = run(1000);
    // More data moves every estimator closer to μ, which is the whole point.
    expect(Math.abs(longer.empiricalMean - 3)).toBeLessThan(Math.abs(short.empiricalMean - 3));
    expect(Math.abs(longer.fanoFactor - 1)).toBeLessThan(Math.abs(short.fanoFactor - 1));
  });

  it('reports mean, variance and Fano consistently with each other', () => {
    const snapshot = run(400);
    expect(snapshot.fanoFactor).toBeCloseTo(
      snapshot.empiricalVariance / snapshot.empiricalMean,
      12,
    );
    expect(snapshot.expectedMean).toBe(snapshot.expectedCount);
    expect(snapshot.expectedVariance).toBe(snapshot.expectedCount);
  });

  it('holds for a second, larger μ with the same seed', () => {
    // Measured: seed 20260801, λ = 8, Δt = 2 (μ = 16), 400 windows →
    // mean 16.2850, variance 17.0815, Fano 1.0489.
    const snapshot = run(400, { rate: 8, windowDuration: 2 });
    expect(snapshot.expectedCount).toBe(16);
    expect(snapshot.empiricalMean).toBeCloseTo(16.285, 10);
    expect(snapshot.empiricalVariance).toBeCloseTo(17.0815, 3);
    expect(snapshot.fanoFactor).toBeCloseTo(1.0489, 3);
    expect(snapshot.checks.every((check) => check.ok)).toBe(true);
  });

  it('never reports NaN, which would not survive JSON', () => {
    for (const steps of [0, 1, 2, 30]) {
      const snapshot = run(steps);
      expect(Number.isFinite(snapshot.empiricalMean)).toBe(true);
      expect(Number.isFinite(snapshot.empiricalVariance)).toBe(true);
      expect(Number.isFinite(snapshot.fanoFactor)).toBe(true);
    }
  });
});

describe('poisson counting — frame independence', () => {
  it('produces the same snapshot however the elapsed time was subdivided', () => {
    const init = { seed: 20260801, params: BASE };
    const target = 25 * POISSON_STEP_SECONDS;

    const coarse = new SimulationRunner(poissonCountingCase, init);
    coarse.advanceBy(target);

    const fine = new SimulationRunner(poissonCountingCase, init);
    for (let i = 0; i < 250; i += 1) fine.advanceBy(target / 250);

    const jittery = new SimulationRunner(poissonCountingCase, init);
    const jitter = [0.016, 0.033, 0.008, 0.05, 0.021, 0.017];
    let delivered = 0;
    let k = 0;
    while (delivered < target) {
      const dt = Math.min(jitter[k % jitter.length] as number, target - delivered);
      jittery.advanceBy(dt);
      delivered += dt;
      k += 1;
    }

    expect(fine.snapshot()).toEqual(coarse.snapshot());
    expect(jittery.snapshot()).toEqual(coarse.snapshot());
    expect(coarse.snapshot().revealedWindows).toBe(25);
  });
});

describe('poisson counting — metrics', () => {
  it('agrees with the snapshot on every shared quantity', () => {
    const runner = new SimulationRunner(poissonCountingCase, { seed: 20260801, params: BASE });
    runner.stepMany(120);
    const snapshot = runner.snapshot();
    const metrics = runner.metrics();
    expect(metrics.revealedWindows).toBe(snapshot.revealedWindows);
    expect(metrics.currentCount).toBe(snapshot.currentCount);
    expect(metrics.totalExposure).toBe(snapshot.totalExposure);
    expect(metrics.empiricalMean).toBe(snapshot.empiricalMean);
    expect(metrics.empiricalVariance).toBe(snapshot.empiricalVariance);
    expect(metrics.fanoFactor).toBeCloseTo(snapshot.fanoFactor, 12);
  });
});
