# SimulaCiencia

[![CI](https://github.com/fbientrigo/simulaciencia/actions/workflows/ci.yml/badge.svg)](https://github.com/fbientrigo/simulaciencia/actions/workflows/ci.yml)

**Modelar · Simular · Comprender**

A reusable simulation engine and interactive web laboratory for teaching
statistical simulation through reproducible experiments, 2D/3D visualizations,
and HTML-based lessons.

Built for an introductory Statistical Simulation course, with the same
components reusable for STEM videos, vertical social captures, standalone web
demos and Anki card styling.

---

## What is in the box

Three complete scientific cases, proven end to end through one pipeline:

```
pure deterministic engine → reusable case → Vue visualization → Slidev lesson → static build
```

1. **Inverse transform sampling.** Watch a uniform draw on (0,1) become an
   exponential variate through `X = −ln(1 − U)/λ`, one draw at a time, with the
   histogram, the empirical CDF and the theoretical curves side by side.
2. **Population decay.** Give each of N₀ simulated objects one exponential
   lifetime, then watch a bounded 3D chamber empty while a synchronized 2D
   survival curve tracks `e^(−λt)`.
3. **Poisson counting.** Open a detector for a window of length Δt and count the
   events. No Poisson sampler is called anywhere: exponential inter-arrival
   times are accumulated until they leave the window, and the number that fit is
   the count. Repeat it a few hundred times and the Poisson law appears —
   then check it, with the empirical mean, the unbiased variance and the Fano
   factor against μ = λΔt.

Everything is deterministic: a seed and a parameter set reproduce a run exactly,
and simulation time never depends on rendering frame rate.

**Clase 01 is the primary classroom deck and it is entirely in Spanish** — every
slide, control, chart label, exercise and presenter note. The code, the comments
and this README stay in English; see [Spanish classroom
content](#spanish-classroom-content) for where the line is and how it is
enforced.

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

| Command                   | What it does                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                | Gallery on <http://localhost:5173> — every laboratory, all display modes |
| `pnpm slides`             | Clase 01 (Spanish, primary) with hot reload                              |
| `pnpm slides:demo`        | The original inverse-transform demonstration deck                        |
| `pnpm test`               | Unit tests (Vitest)                                                      |
| `pnpm test:watch`         | Unit tests in watch mode                                                 |
| `pnpm test:e2e`           | Browser smoke tests (Playwright) — needs `pnpm build` first              |
| `pnpm typecheck`          | Strict `tsc` / `vue-tsc` across every package                            |
| `pnpm lint`               | ESLint, including the engine-boundary rules                              |
| `pnpm format`             | Prettier                                                                 |
| `pnpm build:slides`       | Static HTML for Clase 01 → `apps/classroom/dist`                         |
| `pnpm preview:slides`     | Serve that static build locally                                          |
| `pnpm build:slides:demo`  | The demonstration deck → `apps/classroom/dist-demo`                      |
| `pnpm build:slides:pages` | Clase 01 with the GitHub Pages base → `apps/classroom/dist-pages`        |
| `pnpm build`              | Static production builds of the gallery and the primary deck             |
| `pnpm verify`             | lint → typecheck → test → build, in that order                           |
| `pnpm verify:all`         | The complete local merge gate: `pnpm verify`, then `pnpm test:e2e`       |

Presenting: `pnpm slides`, then `o` for overview, `p` for presenter mode with
the Spanish speaker notes, `f` for full screen.

### The class as static HTML

```bash
pnpm build:slides                       # → apps/classroom/dist
pnpm preview:slides                     # serve it locally
python -m http.server 8080 --directory apps/classroom/dist   # or any static server
```

The build uses a relative base, so the folder works from any host, any
subdirectory, or a USB stick — no server configuration at all.

### Preview the class from CI

Every CI run uploads the built class as an artifact named **`poisson-class-html`**,
from the `quality` job. That upload does not depend on Playwright: a browser
infrastructure failure can never stop a reviewer getting the deck. Download it
from the run's Artifacts section, unzip, and:

```bash
python -m http.server 8080 --directory ./poisson-class-html
```

### Published class

Pushes to `main` publish Clase 01 to GitHub Pages via
`.github/workflows/pages.yml` — Node 22, the pinned pnpm,
`pnpm install --frozen-lockfile`, and `pnpm build:slides:pages` (which sets
`--base /simulaciencia/`). Playwright does not run in that workflow, and the
gallery is not deployed in this milestone so the class keeps the short URL:

<https://fbientrigo.github.io/simulaciencia/>

The workflow needs Pages set to **Source: GitHub Actions** in the repository
settings; until that is done the workflow builds and uploads but the deploy step
cannot publish.

### Local merge gate

Before opening a pull request, run the same checks CI runs:

```bash
pnpm verify:all
```

This is `pnpm verify` (lint, typecheck, unit tests, both production builds)
followed by `pnpm test:e2e` against those exact builds — `test:e2e` reuses the
`dist/` output `verify` just produced, so nothing is built twice.

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`,
using the same pnpm version pinned in `packageManager` (activated through
Corepack, never hardcoded in the workflow) and Node 22.12. Two jobs:

- **quality** — lint, typecheck, unit tests, both production builds, and the
  `poisson-class-html` artifact.
- **e2e** — depends on `quality`, downloads its build output, installs
  Playwright's own Chromium (not the local sandbox fallback described below),
  and runs the browser smoke tests. Traces and failure screenshots are
  uploaded only when the job fails.

---

## Repository layout

```
apps/
  classroom/     slides.md            Clase 01 (Spanish, primary)
                 demo-inverse-transform.md   the original demonstration deck
  gallery/       Vite app: both cases, four display modes, URL-frozen configs
packages/
  schemas/       Zero-dependency contracts: param schema, config envelope, URL codec
  core/          Pure engine: seeded RNG, statistics, SimulationCase, SimulationRunner
  visuals/       Vue components: SVG plots, two laboratories, Three.js lifecycle
  theme/         Design tokens, panels, slide layouts, chart typography, brand mark
cases/
  inverse-transform/
  poisson-counting/
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
| One simulation step reveals exactly one observation window        | `case-poisson-counting.test.ts`                               |
| Moving an event in space cannot change a count                    | same                                                          |
| The Poisson PMF plus its overflow bin sums to one                 | same                                                          |
| Mean, variance and Fano converge to μ, μ and 1                    | same                                                          |
| Teaching stages are cumulative and never touch the model          | `teaching-stages.test.ts`, `engine-purity.test.ts`            |
| Every teaching stage renders what it promises                     | `poisson-components.test.ts`, `tests/e2e/classroom.spec.ts`   |
| The class is in Spanish, with no English UI labels                | `spanish-content.test.ts`                                     |
| Clase 01 builds to servable static HTML                           | `classroom-deck.test.ts`, `pnpm build:slides`                 |
| Results are independent of frame subdivision                      | `frame-independence.test.ts`                                  |
| The engine never touches Vue, Three.js or the DOM                 | `engine-purity.test.ts`                                       |
| Three.js resources are disposed on unmount                        | `three-disposal.test.ts`, `components.test.ts`                |
| The idle camera orbit honours `prefers-reduced-motion`            | `reduced-motion.test.ts`                                      |
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

## Spanish classroom content

Spanish is the classroom language; English is the engineering language. The line
is drawn at what a learner reads:

| In Spanish                                                 | In English                                    |
| ---------------------------------------------------------- | --------------------------------------------- |
| Slide prose, headings, exercises and presenter notes       | Identifiers, types, props and file names      |
| Buttons, control labels, hints and warnings                | Code comments                                 |
| Chart titles, axis labels, table headings and legends      | Commit messages and pull-request descriptions |
| Accessibility labels and the 2D-fallback explanation       | `docs/` and this README                       |
| The Poisson case's `title`, `summary` and parameter schema | Everything else in `packages/` and `cases/`   |

There is **no internationalization framework**, and this milestone does not need
one — Spanish is the only classroom language. What keeps English from drifting
back in is `tests/unit/spanish-content.test.ts`, which extracts the text a
student actually reads (template text nodes, string literals inside `{{ }}`,
`aria-label` / `title` / `alt` / `placeholder`, slide prose and presenter notes)
and fails on known English UI words. It deliberately never scans identifiers,
prop values, CSS classes or comments: a `showHistogram` ref is not English copy,
and a check that flagged it would only teach authors to obfuscate their code.

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
- **Slidev decks are excluded from Prettier.** Prettier reads a per-slide
  front-matter block as a thematic break followed by prose and inserts a blank
  line after the `---`, which stops Slidev seeing the block at all — the slide
  silently loses its layout. `apps/classroom/*.md` is therefore in
  `.prettierignore`; format decks by hand.
- **Statistical tolerances are seed-specific.** They are deliberately fixed facts
  about specific seeded runs, not probabilistic claims — which is what keeps them
  from flaking, but also means changing a seed in a test requires re-measuring.

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
