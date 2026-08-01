# ADR 0001 — Browser-first TypeScript, no Python in the browser

- **Status:** accepted
- **Date:** 2026-08-01

## Context

SimulaCiencia has to serve an online teaching assistantship for an introductory
Statistical Simulation course, and the same components must later be reused for
STEM videos, vertical social captures, standalone web demos and Anki card
styling.

The obvious alternative was to write the numerics in Python — the language the
course itself uses — and run it in the browser through Pyodide, or to keep a
Python backend that renders figures.

## Decision

**Phase one is browser-first TypeScript.** The simulation engine, both cases,
the visual layer and the lesson are all TypeScript running in the browser, with
no backend, no database and no Python execution.

A Python _reference_ package may be added later. It will validate against the
JSON contract in `packages/schemas`, not run in the browser.

## Rationale

1. **Distribution cost.** A lesson has to open from a link, in a lecture hall,
   on a student's phone, on a projector laptop, offline. A static build does
   that. Pyodide is a ~10 MB download before the first pixel; a backend needs
   hosting, uptime and a budget the course does not have.
2. **One language across the whole slice.** The engine, the Vue components and
   the Slidev deck share types. `SimulationSnapshot` is checked at the boundary
   between the model and the renderer at compile time. A Python/TypeScript split
   would put a hand-written serialization layer at the most fragile seam.
3. **Interaction latency.** The pedagogy depends on dragging λ and watching the
   histogram follow within a frame. Round-tripping to Python — in a worker or
   over the network — puts a stutter exactly where the intuition lives.
4. **Reuse targets.** Videos, social captures and Anki cards all consume HTML and
   CSS. A browser-native component reaches all four with one implementation.
5. **Strict typing pays for itself here.** `exactOptionalPropertyTypes` and
   `noUncheckedIndexedAccess` catch the class of bug that quietly corrupts a
   simulation — an off-by-one in a sample array, a silently-undefined parameter.

## Consequences

**Accepted costs**

- Numerical routines are re-implemented rather than borrowed from SciPy. The
  scope is deliberately small (moments, ECDF, histogram, one distribution) and
  each one is unit-tested against closed-form values.
- JavaScript doubles are the only numeric type. Adequate here; it would not be
  for stiff ODEs or long-run MCMC, which are explicitly deferred.
- Course code in Python cannot be pasted into a lesson. The lesson teaches the
  _method_, and the formula is written out in Markdown, so this is survivable.

**What this buys**

- `pnpm build` produces a directory that can be dropped on any static host.
- The engine also runs in Node, so tests are milliseconds and CI needs no
  browser for anything statistical.

## Revisit if

The course needs distributions or estimators where re-implementing is genuinely
risky (special functions, MCMC diagnostics). At that point add the Python
reference package and validate the TypeScript engine against recorded fixtures —
still without running Python in the browser.
