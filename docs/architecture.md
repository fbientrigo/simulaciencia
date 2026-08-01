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
plugin marketplace. Two concrete cases exist; abstractions were extracted only
where both cases demonstrably needed them (`SimulationCase`, `RandomSource`,
`SimulationRunner`, `histogram`/`ecdf`). Nothing was generalized on speculation.

## 7. Future Python reference package

Phase one exposes a stable JSON contract (`SimulationConfig` +
`SimulationSnapshot` envelopes in `packages/schemas`). A future Python package
would re-implement a case and be validated against recorded JSON fixtures — it
would not be executed in the browser.
