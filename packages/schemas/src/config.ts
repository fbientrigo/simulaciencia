/**
 * The serializable envelope that identifies one reproducible simulation state.
 *
 * This is the stable contract mentioned in the roadmap: a future Python
 * reference package, a screenshot service or a saved Anki card only ever needs
 * these five fields to reconstruct exactly what was on screen.
 */
export interface SimulationConfig<P extends Record<string, number> = Record<string, number>> {
  /** Stable case identifier, e.g. `inverse-transform`. */
  readonly caseId: string;
  /** Case contract version. Bump on any breaking change to `params`. */
  readonly version: string;
  /** 32-bit unsigned seed. Together with `params` it fixes every random draw. */
  readonly seed: number;
  /** Validated case parameters. */
  readonly params: P;
  /**
   * Optional frozen simulation time, in simulation seconds.
   * Absent means "at the initial state"; a visual can advance freely from there.
   */
  readonly time?: number;
}

/** Envelope every case snapshot carries, so generic tooling can inspect it. */
export interface SnapshotEnvelope {
  readonly caseId: string;
  readonly version: string;
  readonly seed: number;
  /** Simulation time in seconds; always `stepIndex * fixedDt`. */
  readonly time: number;
  /** Number of fixed steps executed since the last reset. */
  readonly stepIndex: number;
  /** True when further stepping cannot change the snapshot. */
  readonly complete: boolean;
}

const RESERVED_KEYS = new Set(['case', 'seed', 't']);

/**
 * Encode a config into URL query parameters.
 *
 * This is how a slide, a social capture or a screenshot is frozen at a
 * deterministic state — see `docs/recording-content.md`.
 */
export function encodeConfigToQuery(config: SimulationConfig): URLSearchParams {
  const query = new URLSearchParams();
  query.set('case', config.caseId);
  query.set('seed', String(config.seed));
  for (const [key, value] of Object.entries(config.params)) {
    if (RESERVED_KEYS.has(key)) {
      throw new Error(`Parameter name "${key}" is reserved by the URL contract.`);
    }
    query.set(key, String(value));
  }
  if (config.time !== undefined) query.set('t', String(config.time));
  return query;
}

export interface DecodedQuery {
  readonly caseId: string | null;
  readonly seed: number | null;
  readonly time: number | null;
  /** Raw, still unvalidated parameter strings. Feed them to `validateParams`. */
  readonly rawParams: Readonly<Record<string, string>>;
}

/** Split a query string into the envelope fields and the raw parameter bag. */
export function decodeConfigFromQuery(query: URLSearchParams): DecodedQuery {
  const rawParams: Record<string, string> = {};
  for (const [key, value] of query.entries()) {
    if (!RESERVED_KEYS.has(key)) rawParams[key] = value;
  }
  const seedRaw = query.get('seed');
  const timeRaw = query.get('t');
  const seed = seedRaw !== null && seedRaw !== '' ? Number(seedRaw) : NaN;
  const time = timeRaw !== null && timeRaw !== '' ? Number(timeRaw) : NaN;
  return {
    caseId: query.get('case'),
    seed: Number.isFinite(seed) ? seed : null,
    time: Number.isFinite(time) ? time : null,
    rawParams,
  };
}
