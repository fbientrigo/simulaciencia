# SimulaCiencia

**Modelar · Simular · Comprender**

A reusable simulation engine and interactive web laboratory for teaching
statistical simulation through reproducible experiments, 2D/3D visualizations,
and HTML-based lessons.

Built for an introductory Statistical Simulation course, with the same
components reusable for STEM videos, vertical social captures, standalone web
demos and Anki card styling.

---

## What is in the box

Two complete scientific cases, proven end to end through one pipeline:

```
pure deterministic engine → reusable case → Vue visualization → Slidev lesson → static build
```

1. **Inverse transform sampling.** Watch a uniform draw on (0,1) become an
   exponential variate through `X = −ln(1 − U)/λ`, one draw at a time, with the
   histogram, the empirical CDF and the theoretical curves side by side.
2. **Population decay.** Give each of N₀ simulated objects one exponential
   lifetime, then watch a bounded 3D chamber empty while a synchronized 2D
   survival curve tracks `e^(−λt)`.

Everything is deterministic: a seed and a parameter set reproduce a run exactly,
and simulation time never depends on rendering frame rate.

---

## Requirements

- Node **≥ 22.12**
- pnpm **10** (`corepack enable` is enough)

No backend, no database, no Docker, no Python.

---

## Setup

```bash
pnpm install
```

That is the whole setup. Workspace packages ship TypeScript sources, so there is
no build step between them.

---

## Commands

| Command           | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `pnpm dev`        | Gallery on <http://localhost:5173> — both laboratories, all display modes |
| `pnpm slides`     | Slidev lesson with hot reload                                             |
| `pnpm test`       | Unit tests (Vitest)                                                       |
| `pnpm test:watch` | Unit tests in watch mode                                                  |
| `pnpm test:e2e`   | Browser smoke tests (Playwright) — needs `pnpm build` first               |
| `pnpm typecheck`  | Strict `tsc` / `vue-tsc` across every package                             |
| `pnpm lint`       | ESLint, including the engine-boundary rules                               |
| `pnpm format`     | Prettier                                                                  |
| `pnpm build`      | Static production builds of the gallery and the deck                      |
| `pnpm verify`     | lint → typecheck → test → build, in that order                            |

Presenting: `pnpm slides`, then `o` for overview, `p` for presenter mode with
speaker notes, `f` for full screen. `pnpm build:slides` produces static HTML in
`apps/classroom/dist` that works from any host or a USB stick.

---

## Repository layout

```
apps/
  classroom/     Slidev demonstration lesson (slides.md + slide components)
  gallery/       Vite app: both cases, four display modes, URL-frozen configs
packages/
  schemas/       Zero-dependency contracts: param schema, config envelope, URL codec
  core/          Pure engine: seeded RNG, statistics, SimulationCase, SimulationRunner
  visuals/       Vue components: SVG plots, two laboratories, Three.js lifecycle
  theme/         Design tokens, panels, slide layouts, chart typography, brand mark
cases/
  inverse-transform/
  radioactive-decay/
anki/templates/  Card CSS reusing the same tokens
docs/            Architecture, authoring guide, recording guide, roadmap
  adr/           Architecture decision records
tests/
  unit/          Vitest
  e2e/           Playwright
```

Dependencies flow one way: `schemas ← core ← cases ← visuals ← apps`. The engine
and the cases may not import Vue, Three.js, Slidev or the DOM — enforced by
`tests/unit/engine-purity.test.ts` and by an ESLint rule.

---

## The guarantees, and where they are tested

| Guarantee                                                         | Test                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Same seed and parameters ⇒ identical samples                      | `tests/unit/random.test.ts`, `case-inverse-transform.test.ts` |
| A different seed ⇒ a different sample                             | same                                                          |
| Exponential samples are finite and non-negative                   | `random.test.ts`, `case-inverse-transform.test.ts`            |
| Empirical mean and variance converge within documented tolerances | `case-inverse-transform.test.ts`                              |
| Survivor counts never increase                                    | `case-radioactive-decay.test.ts`                              |
| Survivors approach zero over a long horizon                       | same                                                          |
| Results are independent of frame subdivision                      | `frame-independence.test.ts`                                  |
| The engine never touches Vue, Three.js or the DOM                 | `engine-purity.test.ts`                                       |
| Three.js resources are disposed on unmount                        | `three-disposal.test.ts`, `components.test.ts`                |
| Type checking passes                                              | `pnpm typecheck`                                              |
| The Slidev static build succeeds and boots                        | `pnpm build:slides`, `tests/e2e/classroom.spec.ts`            |
| The gallery loads both visualizations                             | `tests/e2e/gallery.spec.ts`                                   |
| A frozen URL reproduces the identical picture                     | same                                                          |

---

## Reproducibility

Every visual state is `(caseId, version, seed, params, time)` — a short URL:

```
?case=radioactive-decay&seed=987654&initialCount=300&rate=0.5&t=3&mode=social-v
```

Two loads of that URL give byte-identical output. See
[docs/recording-content.md](docs/recording-content.md) for screenshots, clips and
display modes.

**The randomness is not cryptographic.** The generator is sfc32 seeded through
splitmix32; see [ADR 0003](docs/adr/0003-prng-choice.md) for why that is the
right trade for teaching and why it must never be used for anything security
relevant.

---

## Selected versions

Chosen for mutual compatibility on 2026-08-01.

| Package    | Version | Note                                                                                                          |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| TypeScript | 5.9.3   | **Not 7.x**: `typescript-eslint@8` requires `<6.1.0`, so 5.9 is the newest version the whole toolchain shares |
| Vue        | 3.5.40  | the version `@slidev/cli@52` itself depends on                                                                |
| Vite       | 8.2.0   | matches Slidev's `vite@^8.1.5` and `vitest@4`'s peer range                                                    |
| Vitest     | 4.1.10  |                                                                                                               |
| Slidev     | 52.18.1 | brings KaTeX 0.18 for in-Markdown maths                                                                       |
| Three.js   | 0.185.1 | with `@types/three@0.185.3`                                                                                   |
| Vue TSC    | 3.3.9   |                                                                                                               |
| ESLint     | 10.8.0  | with `typescript-eslint@8.65` and `vue-eslint-parser@10.4.1`                                                  |
| Playwright | 1.62.1  |                                                                                                               |
| pnpm       | 10.33.0 |                                                                                                               |

Two compatibility decisions worth remembering:

- **TypeScript is pinned below 6.** `typescript-eslint@8.65` declares
  `typescript: >=4.8.4 <6.1.0`. Moving to TS 7 means dropping lint or waiting for
  a `typescript-eslint` that supports it.
- **`vue-eslint-parser` must be ≥ 10.4.1**, because `eslint-plugin-vue@10.10`
  requires it and only ≥ 10.3 accepts ESLint 10.

---

## Known limitations

- **Playwright browser pinning.** `playwright.config.ts` uses a pre-installed
  Chromium at `/opt/pw-browsers/chromium` when it exists, because some sandboxes
  cannot reach the Playwright CDN to download the matching build. On a normal
  machine the file is absent and Playwright resolves its own browser. Override
  with `SIMULACIENCIA_CHROMIUM`.
- **Browser coverage is Chromium only.** Firefox and WebKit projects are not
  configured; the smoke tests answer "does the build boot and paint", not
  "does it look identical everywhere".
- **Snapshots allocate per frame.** `radioactiveDecayCase.snapshot()` builds one
  object per particle. Fine to the schema maximum of 4 000; a case with far more
  entities would need typed-array snapshots.
- **The Anki tokens are a copy.** Anki cannot `@import`, so
  `anki/templates/simulaciencia.css` duplicates the token values and must be
  updated alongside `packages/theme/src/tokens.css`.
- **Statistical tolerances are seed-specific.** They are deliberately fixed facts
  about specific seeded runs, not probabilistic claims — which is what keeps them
  from flaking, but also means changing a seed in a test requires re-measuring.
- **No `prefers-reduced-motion` opt-out for the 3D camera orbit.** The CSS
  transitions respect it; the idle orbit does not yet.

---

## Documentation

- [docs/architecture.md](docs/architecture.md) — layers, determinism model, what is deliberately absent
- [docs/authoring-a-case.md](docs/authoring-a-case.md) — the smallest path to a third case
- [docs/recording-content.md](docs/recording-content.md) — display modes, frozen frames, clips
- [docs/roadmap.md](docs/roadmap.md) — phase 1 vs deferred work
- [ADR 0001](docs/adr/0001-browser-first-typescript.md) — browser-first TypeScript
- [ADR 0002](docs/adr/0002-model-snapshot-visual.md) — model / snapshot / visualization separation
- [ADR 0003](docs/adr/0003-prng-choice.md) — the PRNG, and why it is not cryptographic

---

## License

MIT
