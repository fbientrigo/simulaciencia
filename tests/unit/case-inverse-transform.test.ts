import {
  SimulationRunner,
  exponentialCdf,
  exponentialMean,
  exponentialVariance,
  maxCdfDeviation,
  runnerFromConfig,
} from '@simulaciencia/core';
import {
  inverseTransformCase,
  type InverseTransformParams,
} from '@simulaciencia/case-inverse-transform';
import { encodeConfigToQuery, decodeConfigFromQuery, validateParams } from '@simulaciencia/schemas';
import { describe, expect, it } from 'vitest';

function fullRun(seed: number, params: Partial<InverseTransformParams> = {}) {
  const runner = new SimulationRunner(inverseTransformCase, {
    seed,
    params: { rate: 1.5, sampleCount: 2000, ...params },
  });
  runner.runToCompletion();
  return runner;
}

describe('inverse transform case', () => {
  it('reproduces identical samples for the same seed and parameters', () => {
    const a = fullRun(31337).snapshot();
    const b = fullRun(31337).snapshot();
    expect(a.samples).toEqual(b.samples);
    expect(a.uniforms).toEqual(b.uniforms);
    expect(a).toEqual(b);
  });

  it('produces different samples when only the seed changes', () => {
    const a = fullRun(31337).snapshot();
    const b = fullRun(31338).snapshot();
    expect(a.samples).not.toEqual(b.samples);
    expect(a.rate).toBe(b.rate);
  });

  it('applies exactly the inverse CDF to each uniform', () => {
    const snapshot = fullRun(5, { sampleCount: 200 }).snapshot();
    for (let i = 0; i < snapshot.samples.length; i += 1) {
      const u = snapshot.uniforms[i] as number;
      const x = snapshot.samples[i] as number;
      expect(x).toBeCloseTo(-Math.log1p(-u) / snapshot.rate, 12);
      // Round-trip: pushing X back through F recovers U.
      expect(exponentialCdf(x, snapshot.rate)).toBeCloseTo(u, 12);
    }
  });

  it('emits finite, non-negative variates', () => {
    const snapshot = fullRun(9, { sampleCount: 5000 }).snapshot();
    for (const x of snapshot.samples) {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
    }
  });

  it('converges to 1/λ and 1/λ² within documented tolerances', () => {
    // Deterministic seed and n = 50 000, so these are fixed facts about this
    // exact run rather than a probabilistic claim — the test cannot flake.
    // Observed for seed 20260801: mean is 0.42 % off (0.93 standard errors) and
    // variance is 2.5 % off. The bounds below leave roughly a 2× margin.
    const rate = 1.5;
    const runner = fullRun(20260801, { rate, sampleCount: 50000 });
    const metrics = runner.metrics();

    expect(metrics.empiricalMean).toBeCloseTo(exponentialMean(rate), 2);
    expect(Math.abs(metrics.empiricalMean / exponentialMean(rate) - 1)).toBeLessThan(0.01);
    // The variance estimator of an exponential converges more slowly than the
    // mean — its own relative error is O(√(8/n)) — hence the wider tolerance.
    expect(Math.abs(metrics.empiricalVariance / exponentialVariance(rate) - 1)).toBeLessThan(0.05);
    expect(Math.abs(metrics.empiricalMean - exponentialMean(rate))).toBeLessThan(
      4 * metrics.standardError,
    );
  });

  it('keeps the KS distance to the theoretical CDF small for a large sample', () => {
    const snapshot = fullRun(4242, { rate: 0.9, sampleCount: 50000 }).snapshot();
    expect(maxCdfDeviation(snapshot.samples, (x) => exponentialCdf(x, 0.9))).toBeLessThan(0.01);
  });

  it('reveals exactly one pair per step and reports the latest one', () => {
    const runner = new SimulationRunner(inverseTransformCase, {
      seed: 1,
      params: { rate: 1, sampleCount: 10 },
    });
    expect(runner.snapshot().revealed).toBe(0);
    expect(runner.snapshot().latest).toBeNull();

    runner.step();
    const first = runner.snapshot();
    expect(first.revealed).toBe(1);
    expect(first.latest?.index).toBe(0);

    runner.step();
    expect(runner.snapshot().latest?.index).toBe(1);

    runner.runToCompletion();
    expect(runner.snapshot().revealed).toBe(10);
    expect(runner.complete).toBe(true);
    // Stepping past completion is a no-op, not an error.
    runner.step();
    expect(runner.snapshot().revealed).toBe(10);
  });

  it('rewinds to the identical run on reset', () => {
    const runner = fullRun(64);
    const before = runner.snapshot();
    runner.reset();
    expect(runner.snapshot().revealed).toBe(0);
    runner.runToCompletion();
    expect(runner.snapshot()).toEqual(before);
  });

  it('produces a frozen, JSON-serializable snapshot', () => {
    const snapshot = fullRun(2, { sampleCount: 100 }).snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    expect(roundTripped.samples).toEqual(snapshot.samples);
    expect(roundTripped.histogram.bins).toEqual(snapshot.histogram.bins);
  });

  it('round-trips through the URL config contract', () => {
    const runner = fullRun(555, { rate: 2.2, sampleCount: 300 });
    const config = runner.toConfig();
    const query = encodeConfigToQuery(config);
    const decoded = decodeConfigFromQuery(new URLSearchParams(query.toString()));

    expect(decoded.caseId).toBe('inverse-transform');
    expect(decoded.seed).toBe(555);

    const params = validateParams(inverseTransformCase.schema, decoded.rawParams);
    expect(params.ok).toBe(true);

    const restored = runnerFromConfig(inverseTransformCase, {
      ...config,
      params: params.ok ? params.value : config.params,
    });
    expect(restored.snapshot()).toEqual(runner.snapshot());
  });

  it('rejects parameters outside the schema bounds', () => {
    expect(validateParams(inverseTransformCase.schema, { rate: 0 }).ok).toBe(false);
    expect(validateParams(inverseTransformCase.schema, { sampleCount: 3.5 }).ok).toBe(false);
    expect(validateParams(inverseTransformCase.schema, { rate: 'abc' }).ok).toBe(false);
    expect(validateParams(inverseTransformCase.schema, { rate: '2.5' })).toEqual({
      ok: true,
      value: { rate: 2.5, sampleCount: 500 },
    });
  });
});
