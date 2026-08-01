/**
 * Brand constants and token documentation.
 *
 * The CSS files are the source of truth for values; this module is the source
 * of truth for what each token MEANS. The gallery renders `TOKEN_ROLES` as a
 * living style guide, so a token can never silently lose its rationale.
 */

export const BRAND = Object.freeze({
  name: 'SimulaCiencia',
  tagline: 'Modelar · Simular · Comprender',
  description:
    'A reusable simulation engine and interactive web laboratory for teaching statistical simulation through reproducible experiments, 2D/3D visualizations, and HTML-based lessons.',
});

/** The four places an interactive component has to work unchanged. */
export type DisplayMode = 'slide' | 'embed' | 'social-h' | 'social-v';

export const DISPLAY_MODES: readonly DisplayMode[] = Object.freeze([
  'slide',
  'embed',
  'social-h',
  'social-v',
]);

export const DISPLAY_MODE_LABELS: Readonly<Record<DisplayMode, string>> = Object.freeze({
  slide: 'Slide (16:9 deck)',
  embed: 'Standalone embed',
  'social-h': 'Horizontal capture',
  'social-v': 'Vertical capture',
});

export function displayModeClass(mode: DisplayMode): string {
  return `sc-frame sc-frame--${mode}`;
}

export interface TokenRole {
  readonly token: string;
  readonly role: string;
  readonly usage: string;
}

/** The semantic contract of every colour token. Rendered in the gallery. */
export const TOKEN_ROLES: readonly TokenRole[] = Object.freeze([
  {
    token: '--sc-ink',
    role: 'Deepest neutral',
    usage: 'Body text on light surfaces and the darkest structural lines. Never a data colour.',
  },
  {
    token: '--sc-paper',
    role: 'Light page surface',
    usage: 'Default background of slides, embeds and printed handouts.',
  },
  {
    token: '--sc-theoretical',
    role: 'The closed-form model',
    usage: 'Analytic densities, CDFs, survival curves — anything derived, not sampled.',
  },
  {
    token: '--sc-simulated',
    role: 'The simulated sample',
    usage: 'Histograms, empirical curves, particles — anything produced by the PRNG.',
  },
  {
    token: '--sc-success',
    role: 'Accepted / validated',
    usage: 'Passing checks, converged estimates, accepted proposals.',
  },
  {
    token: '--sc-error',
    role: 'Rejected / failed',
    usage: 'Failing checks and rejected proposals. Never used for plain emphasis.',
  },
  {
    token: '--sc-uncertainty',
    role: 'Uncertainty',
    usage: 'Error bars, confidence bands, standard errors and the sample being drawn right now.',
  },
]);

/**
 * The SimulaCiencia mark: scattered draws on the left resolving into an ordered
 * curve on the right — sampling becoming a model.
 *
 * Shipped as a string so non-Vue consumers (Anki templates, favicons, README)
 * use the same artwork as the Vue component. `currentColor` is deliberately
 * avoided: the two colours carry the sample/model distinction.
 */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="SimulaCiencia">
  <title>SimulaCiencia</title>
  <path d="M4 19.4 C 7.5 15.2, 9.5 12.4, 12 10.3 S 18.5 6.9, 28 5.1"
        fill="none" stroke="var(--sc-theoretical, #4F7CFF)" stroke-width="2"
        stroke-linecap="round" opacity="0.9"/>
  <g fill="var(--sc-simulated, #F59E0B)">
    <circle cx="5.2" cy="24.6" r="1.7"/>
    <circle cx="7.5" cy="9.8" r="1.5"/>
    <circle cx="10.5" cy="21.5" r="1.5"/>
    <circle cx="13.8" cy="14.6" r="1.3"/>
  </g>
  <g fill="var(--sc-theoretical, #4F7CFF)">
    <circle cx="17" cy="8.6" r="1.3"/>
    <circle cx="21.5" cy="6.4" r="1.2"/>
    <circle cx="26" cy="5.3" r="1.2"/>
  </g>
</svg>`;

/** Plain-text wordmark, for terminals, alt text and Anki card headers. */
export const WORDMARK_TEXT = `${BRAND.name} — ${BRAND.tagline}`;
