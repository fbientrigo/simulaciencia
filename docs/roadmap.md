# Roadmap

## Phase 1 — done

The vertical slice, end to end and verified:

- `packages/schemas` — JSON-serializable parameter schema, config envelope, URL codec.
- `packages/core` — sfc32 `RandomSource` with forking; moments, histogram, ECDF,
  Monte Carlo error, deterministic checks; exponential distribution in closed
  form; `SimulationCase` contract; `SimulationRunner` with fixed-step timing.
- `packages/theme` — semantic design tokens with measured contrast, light and
  dark surfaces, panels, slide layouts, chart typography, brand mark.
- `packages/visuals` — hand-written SVG plots, two interactive laboratories,
  explicit Three.js scene lifecycle with a renderer seam.
- `cases/inverse-transform`, `cases/radioactive-decay`.
- `apps/gallery` — both cases, four display modes, URL-frozen configuration.
- `apps/classroom` — an eight-slide Slidev lesson with live KaTeX.
- `anki/templates` — card CSS reusing the same tokens.
- 74 unit tests, 10 browser smoke tests, strict typecheck, lint, static builds.

## Phase 2 — next

In priority order. Each item is small enough to finish in one sitting.

1. **A third case: rejection sampling.** The real test of the architecture — it
   is the first case whose step _rejects_ work, so it will show whether
   `SimulationCase` needs a "wasted draw" concept or whether the snapshot can
   carry it. Follow `docs/authoring-a-case.md` and change nothing else.
2. **Extract a `ScatterPlot` component** if and only if rejection sampling needs
   the same proposal/accept scatter that a fourth case would want.
3. **Lesson 2** on rejection sampling, reusing the deck structure.
4. **A `sampleCount` performance pass** if a case ever needs > 50 000 points on
   screen: typed-array snapshots with a documented aliasing rule.

## Deferred — explicitly not phase 1

These are recorded so nobody re-litigates them mid-sprint.

| Deferred                       | Why, and what would change our mind                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python reference package**   | Phase 1 exposes a stable JSON contract instead. Revisit when a case needs special functions or estimators that are risky to re-implement.         |
| **Anki deck generation**       | The CSS template exists; automated `.apkg` generation needs a note-type contract that only becomes clear after two or three real lessons.         |
| **Audio / narration**          | No pipeline until there is a second lecturer.                                                                                                     |
| **Automated video rendering**  | Screen recording plus a reproducible URL covers a clip a week. Revisit at a clip a day.                                                           |
| **MCMC / Metropolis–Hastings** | Needs convergence diagnostics, burn-in and chain visualisation — a whole phase, not a case.                                                       |
| **Deployment infrastructure**  | `pnpm build` produces static directories; any host serves them.                                                                                   |
| **User accounts**              | No server, therefore no accounts. Student work is identified by seed.                                                                             |
| **Content management**         | Lessons are Markdown in git. That _is_ the CMS.                                                                                                   |
| **Custom Three.js shaders**    | `MeshStandardMaterial` and `InstancedMesh` are sufficient for 4 000 objects. Revisit only for an effect that cannot be expressed with instancing. |
| **State-management framework** | No concrete need appeared. `SimulationRunner` owns the only mutable state, and it is deliberately not reactive.                                   |
| **Plugin architecture**        | Two cases produced four shared abstractions. A registry before the fourth case would be speculation.                                              |

## Known limitations

See the "Known limitations" section of `README.md`, which is kept current with
what the test suite actually covers.
