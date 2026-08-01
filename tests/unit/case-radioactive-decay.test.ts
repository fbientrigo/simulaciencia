import { SimulationRunner, exponentialHalfLife, exponentialSurvival } from '@simulaciencia/core';
import {
  radioactiveDecayCase,
  type RadioactiveDecayParams,
} from '@simulaciencia/case-radioactive-decay';
import { describe, expect, it } from 'vitest';

function makeRunner(seed: number, params: Partial<RadioactiveDecayParams> = {}) {
  return new SimulationRunner(radioactiveDecayCase, {
    seed,
    params: { initialCount: 500, rate: 0.4, ...params },
  });
}

describe('radioactive decay case', () => {
  it('places particles and lifetimes reproducibly from the seed', () => {
    const a = makeRunner(808).snapshot();
    const b = makeRunner(808).snapshot();
    expect(a.particles).toEqual(b.particles);

    const different = makeRunner(809).snapshot();
    expect(different.particles).not.toEqual(a.particles);
  });

  it('keeps every particle inside the chamber bounds', () => {
    for (const p of makeRunner(3).snapshot().particles) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(1);
      expect(p.decayTime).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(p.decayTime)).toBe(true);
    }
  });

  it('never lets the survivor count increase', () => {
    const runner = makeRunner(11);
    let previous = runner.snapshot().active;
    for (let i = 0; i < 1200; i += 1) {
      runner.step();
      const current = runner.snapshot().active;
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it('reports the survival curve as a non-increasing series', () => {
    const runner = makeRunner(12);
    runner.advanceBy(6);
    const curve = runner.snapshot().survivalCurve;
    expect(curve.length).toBeGreaterThan(10);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i]!.fraction).toBeLessThanOrEqual(curve[i - 1]!.fraction);
      expect(curve[i]!.t).toBeGreaterThanOrEqual(curve[i - 1]!.t);
    }
    expect(curve[curve.length - 1]!.t).toBeCloseTo(runner.time, 12);
  });

  it('drives the survivor count to zero over a long horizon', () => {
    const runner = makeRunner(77, { initialCount: 400, rate: 0.5 });
    runner.runToCompletion();
    const snapshot = runner.snapshot();
    expect(snapshot.complete).toBe(true);
    // Horizon is the 0.995 quantile, so under 1 % may remain.
    expect(snapshot.active / snapshot.initialCount).toBeLessThan(0.01);
    expect(snapshot.decayed).toBe(snapshot.initialCount - snapshot.active);
  });

  it('tracks the theoretical survival curve at the half-life', () => {
    const rate = 0.4;
    const runner = makeRunner(20260801, { initialCount: 4000, rate });
    runner.advanceToTime(exponentialHalfLife(rate));
    const metrics = runner.metrics();
    expect(metrics.survivingFraction).toBeCloseTo(0.5, 1);
    expect(Math.abs(metrics.survivingFraction - metrics.theoreticalFraction)).toBeLessThan(0.03);
  });

  it('stays close to e^(−λt) across the whole run', () => {
    const rate = 0.6;
    const runner = makeRunner(999, { initialCount: 4000, rate });
    for (let i = 0; i < 12; i += 1) {
      runner.advanceBy(0.5);
      const { active, initialCount, time } = runner.snapshot();
      expect(Math.abs(active / initialCount - exponentialSurvival(time, rate))).toBeLessThan(0.03);
    }
  });

  it('reports decay events exactly once', () => {
    const runner = makeRunner(404, { initialCount: 200, rate: 0.8 });
    const seen = new Set<number>();
    let total = 0;
    while (!runner.complete) {
      runner.step();
      for (const id of runner.snapshot().justDecayed) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        total += 1;
      }
    }
    expect(total).toBe(runner.snapshot().decayed);
  });

  it('marks a particle dead exactly when time passes its decay time', () => {
    const runner = makeRunner(6, { initialCount: 100, rate: 0.9 });
    runner.advanceBy(3);
    const snapshot = runner.snapshot();
    for (const p of snapshot.particles) {
      expect(p.alive).toBe(p.decayTime > snapshot.time);
    }
    expect(snapshot.particles.filter((p) => p.alive)).toHaveLength(snapshot.active);
  });

  it('produces a frozen, JSON-serializable snapshot with passing checks', () => {
    const runner = makeRunner(2, { initialCount: 300 });
    runner.advanceBy(3);
    const snapshot = runner.snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.checks.every((c) => c.ok)).toBe(true);
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    expect(roundTripped.particles).toEqual(snapshot.particles);
  });

  it('returns to the identical initial state on reset', () => {
    const runner = makeRunner(31);
    const initial = runner.snapshot();
    runner.advanceBy(5);
    runner.reset();
    expect(runner.snapshot()).toEqual(initial);
  });

  it('re-derives placement independently when only the rate changes', () => {
    const runner = makeRunner(55);
    const before = runner.snapshot().particles.map((p) => [p.x, p.y, p.z]);
    runner.reset({ params: { rate: 1.2 } });
    const after = runner.snapshot().particles.map((p) => [p.x, p.y, p.z]);
    // Forking by label means changing λ reshuffles lifetimes but not positions.
    expect(after).toEqual(before);
  });
});
