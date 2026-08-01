# ADR 0003 — sfc32 as the pseudo-random generator

- **Status:** accepted
- **Date:** 2026-08-01

## Context

Every number in the project descends from one 32-bit seed. The generator has to
be:

- **deterministic and portable** — the same seed must give bit-identical output
  in Node, in Chrome, in Firefox and in a future CI runner, or the reproducibility
  guarantee is a lie;
- **fast** — a 50 000-sample redraw happens while a student drags a slider;
- **good enough** that a histogram of 10⁵ draws shows no visible structure;
- **small** — a few dozen lines that a student can read.

`Math.random` disqualifies itself immediately: it cannot be seeded, and the
algorithm is unspecified and varies by engine.

## Decision

**sfc32** ("Small Fast Counting", 32-bit, v4), seeded by expanding the user seed
through **splitmix32**. Implementation: `packages/core/src/random/prng.ts`.

- Arithmetic is `| 0`, `>>> 0` and `Math.imul` only — no BigInt, no typed-array
  reinterpretation — so output is bit-identical across engines.
- Twelve outputs are discarded after seeding so that low-entropy seeds such as
  `0`, `1`, `2` do not correlate in their first draws.
- Stream forking derives a child seed from `splitmix32(seed ^ fnv1a(label))`.
  Forking the same label from the same seed always yields the same sub-stream,
  **regardless of how far the parent has advanced** — that is what lets the decay
  case change λ without reshuffling particle positions.

## Not cryptographic

**sfc32 is not a cryptographically secure generator, and this project must never
be used to produce keys, tokens, nonces or anything security-relevant.** Its
state is 128 bits and fully recoverable from a modest run of output.

That is fine here. The requirement is _statistical_ quality — that estimators
converge to the right values and that a histogram shows no artefacts — not
_adversarial_ unpredictability. Nobody is attacking a lecture slide. Using
`crypto.getRandomValues` instead would cost the one property the whole project
is built on: reproducibility from a seed.

## Why sfc32 specifically

| Candidate          | Verdict                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Math.random`      | Not seedable, engine-defined. Disqualified.                                                                                                                                               |
| Mulberry32         | Simplest, but a 32-bit state means a period of only 2³²; a 50 000-sample redraw is a meaningful fraction of it.                                                                           |
| xorshift128        | Known weakness in the low bits; would show up in `nextUniform`.                                                                                                                           |
| **sfc32**          | 128-bit state, minimum guaranteed period 2³², average ≈ 2¹²⁷, passes PractRand well past the sizes used here, ~20 lines. **Chosen.**                                                      |
| PCG64 / xoshiro256 | Better still, but need 64-bit arithmetic. BigInt is far too slow for a slider drag, and emulating 64-bit with pairs of 32-bit words costs the readability that makes this file teachable. |

## Derived distributions

- **Uniform** `[0,1)`: `nextUint32() × 2⁻³²`. An open-interval variant adds ½ ULP
  for use inside `log`.
- **Exponential**: inverse transform, `−log1p(−U) / λ`. Since `U ∈ [0,1)`, the
  argument `1 − U ∈ (0,1]`, so the result is always finite and non-negative —
  a property of the formula, and a unit test.
- **Standard normal**: basic Box–Muller, consuming exactly two uniforms and
  returning one variate. The second variate is discarded deliberately: caching a
  spare would add hidden state that `clone()` and `fork()` would have to carry,
  and would make the draw count per call non-constant.

## Consequences

- Reproducibility is a testable property, not a hope:
  `tests/unit/random.test.ts` pins seed-determinism, seed-sensitivity, fork
  reproducibility and fork-position independence.
- If the generator is ever replaced, every recorded seed in every slide, note and
  exercise changes meaning. Treat the choice as a versioned part of the public
  contract — a change is a major version bump for all cases.
