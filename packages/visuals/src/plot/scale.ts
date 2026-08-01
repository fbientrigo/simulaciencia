/**
 * The minimum plotting maths needed to draw an SVG axis by hand.
 *
 * This exists instead of a charting library on purpose: the project needs four
 * plot shapes, all of them simple, and full control over markup is what makes
 * the plots themable, accessible and cheap to freeze for a capture.
 */

export interface Scale {
  /** Map a data value onto a pixel coordinate. */
  (value: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  /** The inverse map, used for pointer interaction. */
  invert(pixel: number): number;
}

export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  // A zero-width domain would divide by zero; pin it to the range start instead.
  const factor = span === 0 ? 0 : (r1 - r0) / span;

  const scale = ((value: number) => r0 + (value - d0) * factor) as {
    (value: number): number;
    domain: readonly [number, number];
    range: readonly [number, number];
    invert(pixel: number): number;
  };
  scale.domain = domain;
  scale.range = range;
  scale.invert = (pixel: number): number => (factor === 0 ? d0 : d0 + (pixel - r0) / factor);
  return scale;
}

/** "Nice" round tick values covering a domain, at most `count` of them. */
export function ticks(domain: readonly [number, number], count = 5): readonly number[] {
  const [start, end] = domain;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return [start];

  const rawStep = (end - start) / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep =
    (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;

  const out: number[] = [];
  const first = Math.ceil(start / niceStep) * niceStep;
  for (let value = first; value <= end + niceStep * 1e-9; value += niceStep) {
    // Re-round to kill the accumulated float noise that would print "0.30000000004".
    out.push(Math.round(value / niceStep) * niceStep);
  }
  return out;
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Polyline path data. Returns an empty string for fewer than two points.
 *
 * Generic over the point shape with `{x, y}` accessors by default, so a
 * survival curve of `{t, fraction}` needs two arrow functions rather than a
 * copy of the whole array.
 */
export function linePath<T extends object>(
  points: readonly T[],
  xScale: Scale,
  yScale: Scale,
  toX: (p: T) => number = (p) => (p as unknown as Point2D).x,
  toY: (p: T) => number = (p) => (p as unknown as Point2D).y,
): string {
  if (points.length < 2) return '';
  let d = '';
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i] as T;
    const px = xScale(toX(p));
    const py = yScale(toY(p));
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    d += `${d === '' ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`;
  }
  return d;
}

/** A right-continuous step path — the honest shape of an empirical CDF. */
export function stepPath(
  points: readonly { readonly x: number; readonly p: number }[],
  xScale: Scale,
  yScale: Scale,
): string {
  if (points.length < 2) return '';
  let d = '';
  let previousY = yScale(0);
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i] as { x: number; p: number };
    const px = xScale(p.x);
    const py = yScale(p.p);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    if (d === '') {
      d += `M${px.toFixed(2)} ${previousY.toFixed(2)}`;
    }
    d += `L${px.toFixed(2)} ${previousY.toFixed(2)}L${px.toFixed(2)} ${py.toFixed(2)}`;
    previousY = py;
  }
  return d;
}

/** Format a number for an axis tick: short, stable width, no float noise. */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '';
  const magnitude = Math.abs(value);
  if (magnitude === 0) return '0';
  if (magnitude >= 1000) return value.toExponential(1);
  if (magnitude >= 10) return value.toFixed(0);
  if (magnitude >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

/** Format a statistic for a table or a badge. */
export function formatValue(value: number, digits = 3): string {
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞';
  return value.toFixed(digits);
}
