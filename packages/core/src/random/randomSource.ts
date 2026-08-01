import { hashLabel, mix32, seedSfc32, sfc32Next, type Sfc32State } from './prng.ts';

/**
 * The only source of randomness any simulation is allowed to touch.
 *
 * A case never calls `Math.random`. It receives a `RandomSource` built from the
 * configuration seed, so `(params, seed)` fully determines every draw.
 */
export interface RandomSource {
  /** The seed this stream was created from. Part of the reproducible identity. */
  readonly seed: number;

  /** Raw 32-bit unsigned draw. */
  nextUint32(): number;

  /** Uniform on `[0, 1)`. */
  nextUniform(): number;

  /** Uniform on the open interval `(0, 1)`. Safe to pass to `log`. */
  nextUniformOpen(): number;

  /** Uniform integer on `[minInclusive, maxExclusive)`. */
  nextInt(minInclusive: number, maxExclusive: number): number;

  /** Standard normal, mean 0 and variance 1, via the basic Box–Muller transform. */
  nextNormal(): number;

  /** Exponential with the given rate `λ > 0`, by inverse transform. Always ≥ 0 and finite. */
  nextExponential(rate: number): number;

  /**
   * A new, independent stream derived deterministically from
   * `(this.seed, label)`. Forking the same label from the same seed always
   * yields the same sub-stream regardless of how far the parent has advanced,
   * which is what makes partial re-computation reproducible.
   */
  fork(label: string): RandomSource;

  /** An independent copy positioned exactly where this stream currently is. */
  clone(): RandomSource;
}

const UINT32_SCALE = 1 / 4294967296; // 2^-32

class Sfc32RandomSource implements RandomSource {
  readonly seed: number;
  #state: Sfc32State;

  constructor(seed: number, state?: Sfc32State) {
    this.seed = seed >>> 0;
    this.#state = state ? { ...state } : seedSfc32(this.seed);
    if (!state) {
      // Discard a short warm-up so low-entropy seeds such as 0, 1, 2 do not
      // correlate in their first few outputs.
      for (let i = 0; i < 12; i += 1) sfc32Next(this.#state);
    }
  }

  nextUint32(): number {
    return sfc32Next(this.#state);
  }

  nextUniform(): number {
    return this.nextUint32() * UINT32_SCALE;
  }

  nextUniformOpen(): number {
    return (this.nextUint32() + 0.5) * UINT32_SCALE;
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    const span = maxExclusive - minInclusive;
    if (!Number.isFinite(span) || span <= 0) {
      throw new Error('nextInt requires maxExclusive > minInclusive.');
    }
    return minInclusive + Math.floor(this.nextUniform() * span);
  }

  nextNormal(): number {
    // Basic Box–Muller: consumes exactly two uniforms and returns one variate.
    // The second variate is discarded on purpose — keeping no cached spare means
    // `clone()` and `fork()` need no extra state, and the draw count per call
    // stays constant, which keeps stream positions easy to reason about.
    const u1 = this.nextUniformOpen();
    const u2 = this.nextUniform();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  nextExponential(rate: number): number {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Exponential rate must be a positive finite number, received ${rate}.`);
    }
    // X = -ln(1 - U) / λ with U ∈ [0, 1). `log1p` keeps precision for small U,
    // and 1 - U ∈ (0, 1] guarantees a finite, non-negative result.
    return -Math.log1p(-this.nextUniform()) / rate;
  }

  fork(label: string): RandomSource {
    const derived = mix32((this.seed ^ hashLabel(label)) + 0x9e3779b9) >>> 0;
    return new Sfc32RandomSource(derived);
  }

  clone(): RandomSource {
    return new Sfc32RandomSource(this.seed, this.#state);
  }
}

/** Create the project's default random source. */
export function createRandomSource(seed: number): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`Seed must be an integer in [0, 4294967295], received ${seed}.`);
  }
  return new Sfc32RandomSource(seed);
}

/** Draw `count` exponential variates. Shared by both cases. */
export function sampleExponential(rng: RandomSource, count: number, rate: number): Float64Array {
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 1) out[i] = rng.nextExponential(rate);
  return out;
}

/** Draw `count` uniforms on `[0, 1)`. */
export function sampleUniform(rng: RandomSource, count: number): Float64Array {
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 1) out[i] = rng.nextUniform();
  return out;
}
