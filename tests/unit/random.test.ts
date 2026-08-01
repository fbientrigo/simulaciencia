import { createRandomSource, sampleExponential, sampleUniform } from '@simulaciencia/core';
import { describe, expect, it } from 'vitest';

describe('RandomSource determinism', () => {
  it('produces identical streams for the same seed', () => {
    const a = Array.from(sampleUniform(createRandomSource(12345), 1000));
    const b = Array.from(sampleUniform(createRandomSource(12345), 1000));
    expect(a).toEqual(b);
  });

  it('produces a different stream for a different seed', () => {
    const a = Array.from(sampleUniform(createRandomSource(12345), 1000));
    const b = Array.from(sampleUniform(createRandomSource(12346), 1000));
    expect(a).not.toEqual(b);
    // Not merely a shifted stream: the very first draw must already differ.
    expect(a[0]).not.toBe(b[0]);
  });

  it('keeps uniforms inside [0, 1) and the open variant strictly inside (0, 1)', () => {
    const rng = createRandomSource(7);
    for (let i = 0; i < 20000; i += 1) {
      const u = rng.nextUniform();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      const open = rng.nextUniformOpen();
      expect(open).toBeGreaterThan(0);
      expect(open).toBeLessThan(1);
    }
  });

  it('yields finite standard normals with the expected first two moments', () => {
    const rng = createRandomSource(99);
    const n = 100000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i += 1) {
      const z = rng.nextNormal();
      expect(Number.isFinite(z)).toBe(true);
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    // Deterministic seed, so these are fixed bounds rather than a flaky test.
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.02);
  });

  it('yields finite, non-negative exponential samples', () => {
    const samples = sampleExponential(createRandomSource(2024), 50000, 1.7);
    for (let i = 0; i < samples.length; i += 1) {
      const x = samples[i] as number;
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
    }
  });

  it('rejects invalid exponential rates and out-of-range seeds', () => {
    const rng = createRandomSource(1);
    expect(() => rng.nextExponential(0)).toThrow();
    expect(() => rng.nextExponential(-1)).toThrow();
    expect(() => createRandomSource(-1)).toThrow();
    expect(() => createRandomSource(1.5)).toThrow();
  });
});

describe('stream forking', () => {
  it('is reproducible for the same (seed, label)', () => {
    const first = Array.from(sampleUniform(createRandomSource(42).fork('positions'), 200));
    const second = Array.from(sampleUniform(createRandomSource(42).fork('positions'), 200));
    expect(first).toEqual(second);
  });

  it('gives different labels different streams', () => {
    const parent = createRandomSource(42);
    const positions = Array.from(sampleUniform(parent.fork('positions'), 200));
    const lifetimes = Array.from(sampleUniform(parent.fork('lifetimes'), 200));
    expect(positions).not.toEqual(lifetimes);
  });

  it('is independent of how far the parent has advanced', () => {
    const early = createRandomSource(42);
    const before = Array.from(sampleUniform(early.fork('placement'), 100));

    const late = createRandomSource(42);
    for (let i = 0; i < 5000; i += 1) late.nextUniform();
    const after = Array.from(sampleUniform(late.fork('placement'), 100));

    expect(after).toEqual(before);
  });

  it('clones a stream at its current position', () => {
    const rng = createRandomSource(5);
    for (let i = 0; i < 100; i += 1) rng.nextUniform();
    const clone = rng.clone();
    const a = Array.from(sampleUniform(rng, 50));
    const b = Array.from(sampleUniform(clone, 50));
    expect(a).toEqual(b);
  });
});
