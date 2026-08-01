// Randomness
export type { RandomSource } from './random/randomSource.ts';
export { createRandomSource, sampleExponential, sampleUniform } from './random/randomSource.ts';
export { hashLabel, mix32, seedSfc32, sfc32Next, splitmix32 } from './random/prng.ts';
export type { Sfc32State } from './random/prng.ts';

// Statistics
export type { SampleSummary, Samples } from './stats/moments.ts';
export {
  mean,
  monteCarloStandardError,
  standardDeviation,
  summarize,
  variance,
} from './stats/moments.ts';
export type { Histogram, HistogramBin, HistogramOptions } from './stats/histogram.ts';
export { histogram, suggestBinCount } from './stats/histogram.ts';
export type { CdfPoint } from './stats/ecdf.ts';
export { empiricalCdf, empiricalCdfAt, maxCdfDeviation } from './stats/ecdf.ts';
export type { MonteCarloEstimate } from './stats/experiments.ts';
export { monteCarloEstimate, repeatExperiment } from './stats/experiments.ts';
export type { CheckResult } from './stats/assertions.ts';
export {
  allPassed,
  checkAllFinite,
  checkAllNonNegative,
  checkClose,
  checkNonIncreasing,
} from './stats/assertions.ts';

// Distributions
export type { CurvePoint } from './distributions/exponential.ts';
export {
  exponentialCdf,
  exponentialHalfLife,
  exponentialMean,
  exponentialPdf,
  exponentialQuantile,
  exponentialSurvival,
  exponentialVariance,
  sampleCurve,
} from './distributions/exponential.ts';

// Simulation contract
export type {
  AnySimulationCase,
  SimulationCase,
  SimulationMetrics,
  SimulationStateBase,
} from './simulation/case.ts';
export { defineCase } from './simulation/case.ts';
export type { RunnerInit } from './simulation/runner.ts';
export { SimulationRunner, runnerFromConfig } from './simulation/runner.ts';
export type { StepPlan } from './simulation/time.ts';
export { planSteps, timeAtStep } from './simulation/time.ts';
