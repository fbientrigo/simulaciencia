# Anki templates

A preliminary card style that reuses the SimulaCiencia design tokens, so a
flashcard and a lecture slide read as the same material.

**Deck generation is deferred work.** These files are meant to be pasted into
Anki's card-template editor by hand for now.

## Note type

Create a note type with these fields:

| Field      | Purpose                                             |
| ---------- | --------------------------------------------------- |
| `Topic`    | Short label shown next to the mark, e.g. `Sampling` |
| `Question` | The prompt                                          |
| `Answer`   | The answer body                                     |
| `Formula`  | Optional; rendered in the equation panel            |
| `Note`     | Optional; rendered in the warning panel             |
| `Source`   | Optional; e.g. `Lesson 1, slide 3` or a seed        |

## Installing

1. Tools → Manage Note Types → Cards…
2. Paste `front.html` into **Front Template**.
3. Paste `back.html` into **Back Template**.
4. Paste `simulaciencia.css` into **Styling**.

Maths goes in the fields using Anki's MathJax delimiters, `\(…\)` inline and
`\[…\]` for display.

## Token drift

`simulaciencia.css` inlines the tokens because Anki cannot `@import` from a
package. It is a copy of `packages/theme/src/tokens.css` — when a semantic
colour changes there, update it here in the same commit.
