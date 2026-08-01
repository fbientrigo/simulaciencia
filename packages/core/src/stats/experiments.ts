import type { RandomSource } from '../random/randomSource.ts';
import { monteCarloStandardError, mean, variance } from './moments.ts';

/**
 * Run one experiment `replications` times on independent, reproducible
 * sub-streams and collect a scalar statistic from each run.
 *
 * Each replication gets `rng.fork('replication-<i>')`, so replication `k` is
 * identical no matter how many replications were requested — you can rerun a
 * single interesting replication in isolation.
 */
export function repeatExperiment(
  rng: RandomSource,
  replications: number,
  experiment: (rng: RandomSource, index: number) => number,
): Float64Array {
  if (!Number.isInteger(replications) || replications < 1) {
    throw new Error(`replications must be a positive integer, received ${replications}.`);
  }
  const out = new Float64Array(replications);
  for (let i = 0; i < replications; i += 1) {
    out[i] = experiment(rng.fork(`replication-${i}`), i);
  }
  return out;
}

export interface MonteCarloEstimate {
  readonly replications: number;
  readonly estimate: number;
  readonly variance: number;
  readonly standardError: number;
  /** Half-width of an approximate 95 % interval, `1.96 · SE`. */
  readonly halfWidth95: number;
}

/** Summarise repeated replications into an estimate with its Monte Carlo error. */
export function monteCarloEstimate(replicationResults: ArrayLike<number>): MonteCarloEstimate {
  const se = monteCarloStandardError(replicationResults);
  return {
    replications: replicationResults.length,
    estimate: mean(replicationResults),
    variance: variance(replicationResults),
    standardError: se,
    halfWidth95: 1.959963984540054 * se,
  };
}
