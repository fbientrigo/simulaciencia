import {
  checkAllNonNegative,
  checkClose,
  checkNonIncreasing,
  createRandomSource,
  empiricalCdf,
  empiricalCdfAt,
  exponentialCdf,
  exponentialHalfLife,
  exponentialPdf,
  exponentialQuantile,
  histogram,
  maxCdfDeviation,
  mean,
  monteCarloEstimate,
  monteCarloStandardError,
  repeatExperiment,
  sampleExponential,
  summarize,
  variance,
} from '@simulaciencia/core';
import { describe, expect, it } from 'vitest';

describe('moments', () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];

  it('computes mean and both variance conventions', () => {
    expect(mean(xs)).toBe(5);
    expect(variance(xs, { population: true })).toBe(4);
    expect(variance(xs)).toBeCloseTo(32 / 7, 12);
  });

  it('reports NaN rather than a wrong number for degenerate inputs', () => {
    expect(mean([])).toBeNaN();
    expect(variance([1])).toBeNaN();
    expect(monteCarloStandardError([1])).toBeNaN();
  });

  it('summarises count, extremes and the Monte Carlo standard error', () => {
    const s = summarize(xs);
    expect(s.count).toBe(8);
    expect(s.min).toBe(2);
    expect(s.max).toBe(9);
    expect(s.standardError).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 12);
  });
});

describe('histogram', () => {
  it('bins on a fixed range and normalises to a density', () => {
    const h = histogram([0.1, 0.2, 0.9, 1.4, 1.6], { bins: 2, min: 0, max: 2 });
    expect(h.bins).toHaveLength(2);
    expect(h.binWidth).toBe(1);
    expect(h.bins[0]?.count).toBe(3);
    expect(h.bins[1]?.count).toBe(2);
    expect(h.bins[0]?.frequency).toBeCloseTo(0.6, 12);
    // density integrates to 1 over the range
    const area = h.bins.reduce((acc, b) => acc + b.density * h.binWidth, 0);
    expect(area).toBeCloseTo(1, 12);
  });

  it('puts the closed upper edge in the last bin and drops out-of-range values', () => {
    const h = histogram([2, 5, -1], { bins: 2, min: 0, max: 2 });
    expect(h.bins[1]?.count).toBe(1);
    expect(h.count).toBe(1);
  });

  it('matches the theoretical density for a large deterministic sample', () => {
    const rate = 1.2;
    const samples = sampleExponential(createRandomSource(4242), 200000, rate);
    const h = histogram(samples, { bins: 40, min: 0, max: exponentialQuantile(0.999, rate) });
    for (const bin of h.bins.slice(0, 20)) {
      const expected = exponentialPdf(bin.mid, rate);
      expect(Math.abs(bin.density - expected)).toBeLessThan(0.05);
    }
  });
});

describe('empirical CDF', () => {
  it('is non-decreasing and ends at 1', () => {
    const points = empiricalCdf([3, 1, 2, 5, 4], 5);
    expect(points.map((p) => p.x)).toEqual([1, 2, 3, 4, 5]);
    expect(points.map((p) => p.p)).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('thins large samples while keeping the endpoints', () => {
    const samples = sampleExponential(createRandomSource(11), 50000, 1);
    const points = empiricalCdf(samples, 100);
    expect(points.length).toBeLessThanOrEqual(100);
    expect(points[points.length - 1]?.p).toBeCloseTo(1, 12);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]!.p).toBeGreaterThan(points[i - 1]!.p);
      expect(points[i]!.x).toBeGreaterThanOrEqual(points[i - 1]!.x);
    }
  });

  it('evaluates pointwise and tracks the theoretical CDF', () => {
    const rate = 0.8;
    const samples = sampleExponential(createRandomSource(777), 100000, rate);
    const half = exponentialHalfLife(rate);
    expect(empiricalCdfAt(samples, half)).toBeCloseTo(0.5, 2);
    expect(maxCdfDeviation(samples, (x) => exponentialCdf(x, rate))).toBeLessThan(0.01);
  });
});

describe('repeated experiments', () => {
  it('gives each replication a reproducible independent stream', () => {
    const experiment = (rng: ReturnType<typeof createRandomSource>): number =>
      mean(sampleExponential(rng, 500, 2));

    const first = Array.from(repeatExperiment(createRandomSource(3), 40, experiment));
    const second = Array.from(repeatExperiment(createRandomSource(3), 40, experiment));
    expect(first).toEqual(second);
    // Replication k is the same run whether 40 or 5 were requested.
    const short = Array.from(repeatExperiment(createRandomSource(3), 5, experiment));
    expect(short).toEqual(first.slice(0, 5));
  });

  it('estimates the mean of the sample mean with a shrinking standard error', () => {
    const estimate = monteCarloEstimate(
      repeatExperiment(createRandomSource(8), 200, (rng) => mean(sampleExponential(rng, 1000, 2))),
    );
    expect(estimate.replications).toBe(200);
    expect(estimate.estimate).toBeCloseTo(0.5, 2);
    expect(estimate.halfWidth95).toBeLessThan(0.01);
    expect(Math.abs(estimate.estimate - 0.5)).toBeLessThan(estimate.halfWidth95 * 2);
  });

  it('rejects a non-positive replication count', () => {
    expect(() => repeatExperiment(createRandomSource(1), 0, () => 1)).toThrow();
  });
});

describe('deterministic checks', () => {
  it('passes and fails on fixed thresholds rather than p-values', () => {
    expect(checkClose('mean', 1.02, 1, 0.05).ok).toBe(true);
    expect(checkClose('mean', 1.2, 1, 0.05).ok).toBe(false);
    expect(checkAllNonNegative('non-negative', [0, 1, 2]).ok).toBe(true);
    expect(checkAllNonNegative('non-negative', [0, -0.1]).ok).toBe(false);
    expect(checkNonIncreasing('survivors', [10, 8, 8, 3]).ok).toBe(true);
    expect(checkNonIncreasing('survivors', [10, 8, 9]).ok).toBe(false);
  });

  it('explains the failure in the detail string', () => {
    expect(checkNonIncreasing('survivors', [10, 8, 9]).detail).toContain('rose from 8 to 9');
  });
});
