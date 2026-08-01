# Authoring a new simulation case

The smallest possible path to a third case. Following it touches **two
directories** — the new case, and one line in the app that shows it. No existing
package is modified.

The worked example below is **rejection sampling**, the natural sequel to the two
existing cases.

---

## The five-minute version

```
cases/rejection-sampling/
  package.json
  tsconfig.json
  src/
    case.ts     ← the whole case
    index.ts    ← re-exports
```

1. `pnpm install` (links the new workspace package)
2. Write `case.ts` — schema, state, step, snapshot, metrics
3. Add a test file under `tests/unit/`
4. Render it with an existing plot component, or write a new one

That is the entire contract. If you find yourself editing `packages/core`,
stop and read [When to touch core](#when-to-touch-core).

---

## Step 1 — the package

`cases/rejection-sampling/package.json`:

```json
{
  "name": "@simulaciencia/case-rejection-sampling",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json" },
  "dependencies": {
    "@simulaciencia/core": "workspace:*",
    "@simulaciencia/schemas": "workspace:*"
  }
}
```

`cases/rejection-sampling/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

Then `pnpm install` from the repository root.

---

## Step 2 — parameters

Parameters are always a flat `Record<string, number>`. The schema is the single
source of truth for bounds, step and label — the UI controls read it, so a case
and its interface can never disagree.

```ts
export interface RejectionParams extends Record<string, number> {
  proposalScale: number;
  sampleCount: number;
}

export const rejectionSchema: ParamSchema<RejectionParams> = {
  proposalScale: {
    kind: 'number',
    label: 'Proposal scale M',
    description: 'Envelope height. Larger is always valid but wastes draws.',
    default: 1.6,
    min: 1,
    max: 5,
    step: 0.1,
  },
  sampleCount: {
    kind: 'number',
    label: 'Target accepted n',
    default: 500,
    min: 10,
    max: 20000,
    step: 10,
    integer: true,
  },
};
```

The **seed is not a parameter**. It lives in the config envelope and is handed to
you as a `RandomSource`.

---

## Step 3 — state, step, snapshot

```ts
export const rejectionCase = defineCase<Params, State, Snapshot, Metrics>({
  id: 'rejection-sampling',
  version: '1.0.0',
  title: 'Rejection sampling',
  summary: 'Propose from an easy density, accept with probability f(x)/(M·g(x)).',
  schema: rejectionSchema,
  fixedDt: 0.02,

  createState(params, rng) {
    // ALL randomness happens here, drawn only from `rng`.
    // Pre-computing everything up front is usually the right call: it makes
    // reproducibility obvious and makes `step` trivially pure.
    const proposals = new Float64Array(params.sampleCount * 4);
    // …
    return { stepIndex: 0, time: 0, params, seed: rng.seed, proposals, revealed: 0 };
  },

  step(state) {
    const stepIndex = state.stepIndex + 1;
    return { ...state, stepIndex, time: stepIndex * 0.02, revealed: state.revealed + 1 };
  },

  isComplete(state) {
    return state.revealed >= state.proposals.length;
  },

  snapshot(state) {
    return Object.freeze({
      caseId: 'rejection-sampling',
      version: '1.0.0',
      seed: state.seed,
      time: state.time,
      stepIndex: state.stepIndex,
      complete: state.revealed >= state.proposals.length,
      // …your renderer-independent view model
    });
  },

  metrics(state) {
    return Object.freeze({ acceptanceRate: /* … */ 0 });
  },
});
```

### The four rules

1. **`createState` draws everything.** No `Math.random`, no `Date.now`. If you
   need two independent streams, use `rng.fork('label')` — the same label from
   the same seed always gives the same sub-stream.
2. **`step` is pure and takes no time argument.** One call = one `fixedDt`. The
   runner decides how many calls a frame buys; a case that reads elapsed wall
   time breaks frame independence.
3. **Time is `stepIndex * fixedDt`.** Never accumulate a float.
4. **`snapshot` returns frozen, JSON-serializable data.** No `Float64Array`, no
   class instances, no functions. `JSON.parse(JSON.stringify(snapshot))` must
   round-trip.

The cheapest way to satisfy 2 and 3 is the pattern the decay case uses: make the
snapshot a **pure function of time**, so subdividing frames provably cannot
change anything.

---

## Step 4 — tests

Copy the shape of `tests/unit/case-radioactive-decay.test.ts`. At minimum:

```ts
it('reproduces identical output for the same seed', () => {
  /* … */
});
it('produces different output for a different seed', () => {
  /* … */
});
it('produces a frozen, JSON-serializable snapshot', () => {
  /* … */
});
it('converges to the closed-form value within a documented tolerance', () => {
  /* … */
});
```

Add the case's source directory to `PURE_ROOTS` in
`tests/unit/engine-purity.test.ts` so the import boundary is enforced for it too.

**Prefer deterministic invariants to probabilistic assertions.** With a fixed
seed, "the mean is within 1 %" is a fact about that exact run, not a coin flip.
Record the measured error in a comment so a future reader knows the margin.

---

## Step 5 — show it

The fastest path uses the existing plot components:

```vue
<script setup lang="ts">
import { rejectionCase } from '@simulaciencia/case-rejection-sampling';
import { HistogramPlot, useSimulation } from '@simulaciencia/visuals';

const sim = useSimulation(rejectionCase, { seed: 20260801 });
</script>

<template>
  <section class="sc-frame sc-frame--embed">
    <HistogramPlot
      :histogram="sim.snapshot.value.histogram"
      :density="sim.snapshot.value.theoreticalDensity"
    />
  </section>
</template>
```

Add the component to `packages/visuals/src/index.ts`, then drop it into
`apps/gallery/src/App.vue` and into a slide with a wrapper in
`apps/classroom/components/`.

---

## When to touch core

`packages/core` grows only when **two or more cases** need the same thing.

- Need a beta distribution? It belongs in `core/src/distributions/` only once a
  second case wants it. Until then, keep it in your case.
- Need a new plot? Build it in your case's component first. Promote it to
  `packages/visuals` when a second case reuses it.
- Need a new field kind in `ParamSchema` (a boolean toggle, an enum)? That is a
  legitimate core change — add exactly the shape you need, not a general
  validation framework.

This is deliberate. The first two cases produced exactly four shared
abstractions (`RandomSource`, `SimulationCase`, `SimulationRunner`, the
statistics helpers). Nothing was generalized before a second case demanded it.

### The third case, as a worked example

`cases/poisson-counting` is the most recent case and the closest thing to a
reference implementation of this guide. Read it for four things this document
only describes in the abstract:

- **Precomputation in `createState`, revelation in `step`.** Every observation
  window is generated up front; one step reveals exactly one of them. That keeps
  `step` trivially pure and makes "N windows" and "N × `fixedDt`" the same
  statement, which is what lets a slide restore an exact starting frame from a
  number.
- **`fixedDt` is playback time, not physical time.** `POISSON_STEP_SECONDS` is
  0.25 s of lecture pacing; the physical exposure is a separate snapshot field,
  `revealedWindows × windowDuration`. If your case has two clocks, expose both
  and name them differently.
- **One deterministic fork per concern.** Each window forks
  `window:<i>:arrivals` and `window:<i>:positions` from the root source.
  Because `fork` derives a stream from `(seed, label)` rather than from the
  parent's current position, changing how events are placed on screen provably
  cannot move a single count — asserted directly in
  `case-poisson-counting.test.ts`.
- **No `NaN` in a snapshot.** An undefined estimator reports `0`, and
  `revealedWindows` — not the value — tells a reader whether the number means
  anything. `NaN` survives `JSON.stringify` only as `null`, which would break
  the round-trip guarantee every snapshot makes.

It also shows where NOT to reach for core: the Poisson PMF is implemented in
`cases/poisson-counting/src/poisson.ts` with a stable recurrence, and stays
there until a second case wants it.

### Presentation belongs to the presentation layer

If your case is going to be taught in stages, the stages go in
`packages/visuals`, never in the case. See `TeachingStage` in
[architecture.md](architecture.md#teachingstage-belongs-to-the-presentation-layer).

---

## Checklist

- [ ] `pnpm install` links the package
- [ ] `pnpm typecheck` passes (strict mode, `noUncheckedIndexedAccess`)
- [ ] `pnpm lint` passes (the boundary rule blocks `vue`/`three` imports)
- [ ] Seed determinism and seed sensitivity are tested
- [ ] The snapshot round-trips through JSON
- [ ] The case directory is listed in `engine-purity.test.ts`
- [ ] The case is aliased in `vitest.config.ts` and excluded in both app
      `vite.config.ts` files
- [ ] No `TeachingStage`, no `NaN` in the snapshot, no browser global
- [ ] `pnpm test` is green
