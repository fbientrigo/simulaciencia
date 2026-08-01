/**
 * 32-bit integer primitives behind `RandomSource`.
 *
 * Everything here is deliberately plain arithmetic on `number` using
 * `| 0`, `>>> 0` and `Math.imul`, so results are bit-identical on every
 * JavaScript engine. No BigInt, no typed-array tricks, no platform dependence.
 *
 * NOT CRYPTOGRAPHIC. See docs/adr/0003-prng-choice.md.
 */

/** Mutable 128-bit state of the sfc32 generator. */
export interface Sfc32State {
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * splitmix32 — a fast 32-bit mixing function with good avalanche behaviour.
 * Used only to expand a single user-facing seed into sfc32's four words, and
 * to derive child seeds when forking a stream.
 */
export function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/** One-shot splitmix32 mix of a single 32-bit word. */
export function mix32(value: number): number {
  let t = value | 0;
  t ^= t >>> 16;
  t = Math.imul(t, 0x21f0aaad);
  t ^= t >>> 15;
  t = Math.imul(t, 0x735a2d97);
  t ^= t >>> 15;
  return t >>> 0;
}

/** FNV-1a over UTF-16 code units. Turns a fork label into a 32-bit word. */
export function hashLabel(label: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i += 1) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Expand a user seed into sfc32's four state words. */
export function seedSfc32(seed: number): Sfc32State {
  const next = splitmix32(seed >>> 0);
  return { a: next(), b: next(), c: next(), d: next() };
}

/**
 * sfc32 (Small Fast Counting, 32-bit, v4) — one step, returns a uint32.
 * Chosen for speed, a guaranteed minimum period of 2^32 with an average
 * around 2^127, and for passing PractRand at the sizes this project uses.
 */
export function sfc32Next(state: Sfc32State): number {
  const t = ((state.a + state.b) | 0) + state.d;
  state.d = (state.d + 1) | 0;
  state.a = state.b ^ (state.b >>> 9);
  state.b = (state.c + (state.c << 3)) | 0;
  state.c = (state.c << 21) | (state.c >>> 11);
  state.c = (state.c + t) | 0;
  return t >>> 0;
}
