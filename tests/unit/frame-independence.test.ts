import { SimulationRunner, planSteps } from '@simulaciencia/core';
import { inverseTransformCase } from '@simulaciencia/case-inverse-transform';
import { radioactiveDecayCase } from '@simulaciencia/case-radioactive-decay';
import { describe, expect, it } from 'vitest';

/**
 * The guarantee under test: rendering FPS may not influence results.
 * A simulation advanced in one big chunk and in many small chunks must land on
 * byte-identical snapshots.
 */
describe('fixed-step planning', () => {
  it('turns one large chunk and many small chunks into the same step count', () => {
    const dt = 0.02;
    expect(planSteps(1, dt).steps).toBe(50);

    let carry = 0;
    let steps = 0;
    for (let i = 0; i < 100; i += 1) {
      const plan = planSteps(carry + 0.01, dt);
      carry = plan.remainder;
      steps += plan.steps;
    }
    expect(steps).toBe(50);
  });

  it('carries the sub-step remainder instead of dropping or duplicating it', () => {
    const plan = planSteps(0.05, 0.02);
    expect(plan.steps).toBe(2);
    expect(plan.remainder).toBeCloseTo(0.01, 12);
  });

  it('never runs steps for non-positive or non-finite elapsed time', () => {
    expect(planSteps(0, 0.02).steps).toBe(0);
    expect(planSteps(-1, 0.02).steps).toBe(0);
    expect(planSteps(Number.NaN, 0.02).steps).toBe(0);
    expect(() => planSteps(1, 0)).toThrow();
  });

  it('caps a catastrophic elapsed value so a stalled tab cannot freeze a slide', () => {
    expect(planSteps(1e9, 0.02, 1000).steps).toBe(1000);
  });
});

describe('frame subdivision independence', () => {
  const decayInit = { seed: 20260801, params: { initialCount: 300, rate: 0.4 } };

  it('produces the same decay snapshot regardless of frame size', () => {
    const coarse = new SimulationRunner(radioactiveDecayCase, decayInit);
    coarse.advanceBy(4);

    const fine = new SimulationRunner(radioactiveDecayCase, decayInit);
    for (let i = 0; i < 400; i += 1) fine.advanceBy(0.01);

    const irregular = new SimulationRunner(radioactiveDecayCase, decayInit);
    // A deliberately jittery frame budget, the way a real browser behaves.
    const jitter = [0.016, 0.033, 0.008, 0.05, 0.021, 0.017];
    let delivered = 0;
    let k = 0;
    while (delivered < 4) {
      const dt = Math.min(jitter[k % jitter.length] as number, 4 - delivered);
      irregular.advanceBy(dt);
      delivered += dt;
      k += 1;
    }

    expect(fine.stepIndex).toBe(coarse.stepIndex);
    expect(irregular.stepIndex).toBe(coarse.stepIndex);
    expect(fine.snapshot()).toEqual(coarse.snapshot());
    expect(irregular.snapshot()).toEqual(coarse.snapshot());
  });

  it('produces the same inverse-transform snapshot regardless of frame size', () => {
    const init = { seed: 7, params: { rate: 1.5, sampleCount: 400 } };
    const coarse = new SimulationRunner(inverseTransformCase, init);
    coarse.advanceBy(2);

    const fine = new SimulationRunner(inverseTransformCase, init);
    for (let i = 0; i < 200; i += 1) fine.advanceBy(0.01);

    expect(fine.snapshot()).toEqual(coarse.snapshot());
  });

  it('keeps simulation time exactly stepIndex × fixedDt, never an accumulator', () => {
    const runner = new SimulationRunner(radioactiveDecayCase, decayInit);
    for (let i = 0; i < 500; i += 1) runner.advanceBy(0.00723);
    expect(runner.time).toBe(runner.stepIndex * radioactiveDecayCase.fixedDt);
  });
});
