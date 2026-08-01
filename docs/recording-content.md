# Recording content

How to get a lecture, a screenshot or a social clip out of the same components
the lesson uses — without a video editor, and without a figure that cannot be
reproduced.

## The one rule

**Every recorded artefact must carry its seed.** A frame you cannot re-create is
not evidence, it is decoration. Both laboratories expose their configuration as
a URL, and the URL is the whole record.

---

## Display modes

`packages/theme/src/layouts.css` defines four modes. Pass `mode` to any
laboratory component.

| Mode       | Aspect              | Used for        | Behaviour                             |
| ---------- | ------------------- | --------------- | ------------------------------------- |
| `slide`    | fills the deck area | Slidev lessons  | controls beside the plot              |
| `embed`    | content height      | web pages, docs | bordered card, full controls          |
| `social-h` | 16 : 9              | landscape video | controls hidden                       |
| `social-v` | 9 : 16              | vertical video  | stacked, larger type, controls hidden |

Capture modes hide every button, so a recording never shows a cursor hovering a
control that the viewer cannot press. Layout is driven by **container queries**,
not the viewport: a component laid out at 480 px looks the same whether that
480 px is a phone or a narrow column on a 4K display.

---

## Freezing a deterministic frame

A component is frozen by `seed` + `params` + `freezeAtTime`. In the gallery this
is entirely URL-driven:

```
?case=radioactive-decay&seed=987654&initialCount=300&rate=0.5&t=3&mode=social-v
```

| Key             | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| `case`          | which case the URL pins (`inverse-transform`, `radioactive-decay`) |
| `seed`          | 32-bit unsigned integer                                            |
| `t`             | simulation time in seconds to fast-forward to, then stop           |
| `mode`          | one of the four display modes                                      |
| `theme`         | `dark` to force the dark surface                                   |
| _anything else_ | a case parameter, validated against its schema                     |

Two loads of the same URL produce byte-identical output. That is asserted in
`tests/e2e/gallery.spec.ts` ("a frozen URL config reproduces the identical
picture on reload").

When `freezeAtTime` is set, the 3D chamber's idle camera orbit is switched off
(`spinRate: 0`), so two screenshots of the same URL match pixel for pixel.

In code, the same thing:

```ts
const config = runner.toConfig(); // { caseId, version, seed, params, time }
const query = encodeConfigToQuery(config);
const restored = runnerFromConfig(inverseTransformCase, config);
```

---

## Recipes

### A still for a slide, a paper or an Anki card

1. Open the gallery, tune the parameters until the picture says what you want.
2. Press **Copy permalink** under the laboratory.
3. Open the link in a clean window and screenshot the component's bounding box.
4. **Paste the permalink into the figure caption.**

### A landscape clip (16:9)

1. Build the permalink with `mode=social-h` and **no** `t` parameter — you want
   it to animate.
2. Open it, size the browser window to 1920 × 1080, hide browser chrome.
3. Record the screen; press Play in the component before you start if the deck
   is paused.

Speed is a _viewing_ control. Setting 4× does not change the simulation — the
survivor curve is identical, you simply watch it faster. That is the point of
fixed-step timing and it is worth saying out loud in a video.

### A vertical clip (9:16)

Same, with `mode=social-v`. The vertical frame stacks the chamber above the
survival curve and drops the CDF plot, because a 9:16 frame cannot carry two
plots side by side and stay readable at phone size.

### Presenting the lesson live

```bash
pnpm slides           # dev server with hot reload
pnpm build:slides     # static HTML in apps/classroom/dist
```

Press `o` for the slide overview, `d` for dark mode, `f` for full screen.
The deck is a normal static site — copy `dist/` onto any host, or open it from
a USB stick if the lecture-hall network fails.

Speaker notes live in HTML comments in `slides.md` and show in presenter mode
(`p`). The notes on the interactive slides say which parameter to change first;
that is the part that is easy to forget while talking.

---

## What is deliberately not here

No automated video rendering, no audio, no narration, no timeline editor. Those
are on the deferred list in `docs/roadmap.md`. Screen recording plus a
reproducible URL covers the actual need — a lecturer producing one clip a week —
without a pipeline to maintain.

---

## Checklist before publishing

- [ ] The seed is visible in the frame, in the caption, or both
- [ ] The permalink reopens to exactly the recorded state
- [ ] Capture mode is on, so no controls or focus rings are in shot
- [ ] Colours still read on the intended surface — theoretical is blue,
      simulated is amber, and neither is used for anything else
- [ ] If a claim about convergence is on screen, `n` is on screen too
