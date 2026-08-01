# ADR 0002 — Separate model, snapshot and visualization

- **Status:** accepted
- **Date:** 2026-08-01

## Context

The same simulation must appear as a 3D chamber, a 2D survival curve, a slide, a
vertical social capture and — eventually — a still image in a flashcard. The
tempting shortcut is to let the visual component own the simulation: keep the
particle array in a `ref`, mutate it in the animation frame, read statistics off
it in a `computed`.

That shortcut fails in four specific ways, all of which are requirements here:

- results start depending on frame rate, because the frame loop _is_ the model;
- a second renderer of the same data has to duplicate the logic;
- nothing is reproducible, because the state has no identity to re-create it;
- the statistics cannot be unit-tested without mounting a component.

## Decision

Three distinct concepts, with a one-way flow:

```
State  ──snapshot()──▶  Snapshot  ──props──▶  Visual component
  ▲                                                │
  └──────────── commands (step / reset) ◀──────────┘
```

- **State** — whatever is fastest to advance (`Float64Array`, counters). Private
  to the case, never leaves `cases/*`.
- **Snapshot** — frozen, JSON-serializable, renderer-agnostic. The only thing a
  component ever holds.
- **Metrics** — derived scalars for tables, captions and assertions.

Enforced by:

- `SimulationCase` in `packages/core/src/simulation/case.ts`;
- `tests/unit/engine-purity.test.ts`, which fails on any `vue`, `three`,
  `document`, `window`, `Math.random` or `Date.now` in the engine or cases;
- an ESLint boundary rule with the same content in `eslint.config.js`.

## Consequences

**What it makes possible**

- `DecayChamber3D` and `SurvivalPlot` read the _same_ snapshot, so the 3D scene
  and the 2D curve cannot drift out of sync — there is no second clock to drift.
- The WebGL 2 fallback is a rendering decision, not a simulation decision. When
  WebGL is missing the component draws an x–y projection of the same snapshot,
  and the numbers on screen are unchanged.
- `SimulationRunner.toConfig()` produces `{caseId, version, seed, params, time}` —
  enough to reproduce a frame exactly, which is how slides and captures are
  frozen via URL parameters.
- Every statistical assertion in the test suite runs headless in milliseconds.

**Accepted costs**

- Snapshots allocate. `radioactiveDecayCase.snapshot()` builds one object per
  particle per call. Mitigated by memoising per state object in the runner
  (one snapshot per frame at most) and by pre-sorting lifetimes at
  initialisation. At 4 000 objects this is comfortably inside a frame budget; a
  future case with 100 000 entities would need typed-array snapshots and a
  documented aliasing rule.
- There is boilerplate: a case must define state, snapshot and metrics
  separately even when they overlap.

## Rejected alternatives

- **Reactive state in a Pinia store.** Adds a dependency and a second source of
  truth, and reactivity would silently make snapshots mutable-by-reference.
- **A Three.js wrapper library.** Would hide exactly what must stay explicit:
  scene construction, per-frame update and `dispose()`. `createDecayScene` keeps
  all three readable, which is why the disposal test can be precise.
- **Letting components own an RNG.** Two components with two RNGs cannot be
  reproduced from one seed.
