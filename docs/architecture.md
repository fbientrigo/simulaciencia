# SimulaCiencia — Architecture

> Modelar · Simular · Comprender

This note is the contract that the rest of the repository implements. Read it
before adding a package, a case, or a visualization.

## 1. The one-way data flow

SimulaCiencia exists to prove a single pipeline end to end:

```
pure deterministic engine   (packages/core)
        ↓ implements
reusable scientific case    (cases/*)
        ↓ emits immutable snapshot
interactive Vue component   (packages/visuals)
        ↓ embedded in
Slidev HTML lesson          (apps/classroom)   +   gallery (apps/gallery)
        ↓
static production build
```

Data flows **downward only**. A visualization never writes into engine state; it
sends a _command_ (set params, step, reset) to a runner and receives a new
snapshot. There is no shared mutable object between layer boundaries.

## 2. Layers and their hard rules

| Layer     | Package                  | May import                   | Must never import       |
| --------- | ------------------------ | ---------------------------- | ----------------------- |
| Contracts | `@simulaciencia/schemas` | nothing                      | anything                |
| Engine    | `@simulaciencia/core`    | `schemas`                    | vue, three, DOM, slidev |
| Cases     | `@simulaciencia/case-*`  | `core`, `schemas`            | vue, three, DOM, slidev |
| Design    | `@simulaciencia/theme`   | nothing (CSS + tokens)       | engine internals        |
| Visuals   | `@simulaciencia/visuals` | all of the above, vue, three | app-specific code       |
| Apps      | `apps/*`                 | all packages                 | each other              |

`packages/core` and `cases/*` are checked by a unit test that walks their source
and fails on any `vue`, `three`, `document`, or `window` import. The engine must
run unchanged in Node, in a worker, or in a future CLI.

### `TeachingStage` belongs to the presentation layer

A **teaching stage** says how much of a laboratory a class has earned the right
to see at this point in a lesson: `scene`, `manual`, `counter`, `automatic`,
`histogram`, `theory`, `diagnostics`. It lives in
`packages/visuals/src/teaching/stages.ts` and it is a PRESENTATION concept, not
a scientific one.

The distinction is load-bearing, so it is enforced rather than described. A case
that could ask "which stage am I in?" would be able to compute different numbers
for different slides, and the project's central claim — that a seed plus a
parameter set reproduces a run exactly — would quietly stop being true. So
`packages/core`, `packages/schemas` and `cases/*` may not so much as name
`TeachingStage`; `engine-purity.test.ts` fails if they do.

What a stage may do: decide what is drawn. What it may never do: change what is
computed. Given the same seed and parameters, `scene` and `diagnostics` hold the
identical simulation — one of them just draws more of it.

The stages are cumulative, and that is a property of the construction rather
than a convention: each row of `STAGE_FEATURES` is literally built by spreading
the previous one, and `teaching-stages.test.ts` asserts that no stage ever loses
a feature the one before it had. Components read that one matrix instead of
scattering `stage === 'histogram' || stage === 'theory' || …` through a
template, which is how a stage silently loses a feature the lesson depends on.

## 3. Determinism model

Three independent guarantees, each with its own test:

1. **Seed determinism.** `(caseId, params, seed)` fully determines every number
   the simulation will ever produce. `createState` draws everything it needs
   from a `RandomSource` created from the seed. No `Math.random`, no `Date.now`.
2. **Frame independence.** Simulation time is an _integer step counter_ times a
   fixed `dt`. `SimulationRunner.advanceBy(seconds)` accumulates wall time and
   emits whole fixed steps. Advancing 1 s in one call and in 100 calls of 10 ms
   produces byte-identical snapshots. Rendering FPS is therefore irrelevant to
   results.
3. **Snapshot immutability.** `snapshot(state)` returns a frozen,
   JSON-serializable view model. Visual components hold snapshots, never state.

Because of (1) and (3), any visual state is reproducible from a short URL:
`?case=…&seed=…&rate=…&t=…`. That is how slides, social captures and screenshots
are frozen.

## 4. Randomness

`RandomSource` is an interface; `createRandomSource(seed)` returns the default
implementation backed by **sfc32** seeded through **splitmix32**
(see `packages/core/src/random/`). It provides `nextUniform`, `nextNormal`,
`nextExponential(rate)` and `fork(label)` for reproducible sub-streams.

This is **not** a cryptographic generator and must never be used for secrets.
The rationale for sfc32 is in `docs/adr/0003-prng-choice.md`.

## 5. Why the snapshot is a separate concept

A case has three distinct shapes and conflating them is the classic mistake:

- **State** — whatever is fastest to advance (typed arrays, counters, mutable
  scratch). Private to the case.
- **Snapshot** — small, frozen, serializable, renderer-agnostic. Public.
- **Metrics** — scalar derived quantities for tables and assertions. Public.

A `DecayChamber3D` and a plain SVG survival curve consume the _same_ snapshot.
Neither knows the other exists. See `docs/adr/0002-model-snapshot-visual.md`.

## 6. What is deliberately absent

No backend, no database, no auth, no Docker, no Pyodide, no state-management
framework, no charting library, no Three.js wrapper, no custom shaders, no
plugin marketplace, no internationalization framework. Three concrete cases
exist; abstractions were extracted only where the cases demonstrably needed them
(`SimulationCase`, `RandomSource`, `SimulationRunner`, `histogram`/`ecdf`).
Nothing was generalized on speculation.

The counting detector is the clearest recent example. Adding a second 3D scene
pulled exactly two things out of `decayScene.ts` — the WebGL 2 capability probe
and the disposal registry — because both were identical and both are testable
without a GPU. Cameras, lights, entities, detector geometry and scene graphs
were **not** generalized: the two scenes genuinely want different ones, and a
"generic Three.js framework" would have cost more than the duplication it
removed. Likewise, the Poisson PMF lives in `cases/poisson-counting`, not in
`packages/core`, until a second case needs the same recurrence.

## 7. Future Python reference package

Phase one exposes a stable JSON contract (`SimulationConfig` +
`SimulationSnapshot` envelopes in `packages/schemas`). A future Python package
would re-implement a case and be validated against recorded JSON fixtures — it
would not be executed in the browser.
