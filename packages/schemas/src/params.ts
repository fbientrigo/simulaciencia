/**
 * A deliberately tiny parameter-schema language.
 *
 * It exists for three reasons and nothing else:
 *  1. validate untrusted input (URL query strings, slide front-matter, user typing);
 *  2. give UI controls their bounds, step and label without duplicating them;
 *  3. make a case's configuration JSON-serializable and round-trippable.
 *
 * It is not a general validation library. If a case ever needs something this
 * cannot express, add exactly that shape here — do not reach for a dependency.
 */

/** A real-valued parameter rendered as a slider plus a numeric input. */
export interface NumberFieldSpec {
  readonly kind: 'number';
  /** Human label used by controls and by generated documentation. */
  readonly label: string;
  /** One-line explanation shown as help text. */
  readonly description?: string;
  /** Unit suffix, e.g. `s⁻¹`. Purely presentational. */
  readonly unit?: string;
  readonly default: number;
  readonly min: number;
  readonly max: number;
  /** UI granularity. Values off the step are still accepted. */
  readonly step: number;
  /** When true the value must be an integer. */
  readonly integer?: boolean;
}

/** A 32-bit unsigned seed. Kept distinct so UIs can render a dedicated control. */
export interface SeedFieldSpec {
  readonly kind: 'seed';
  readonly label: string;
  readonly description?: string;
  readonly default: number;
}

export type FieldSpec = NumberFieldSpec | SeedFieldSpec;

/** Maps every key of a parameter object to its field specification. */
export type ParamSchema<P extends Record<string, number>> = {
  readonly [K in keyof P]-?: FieldSpec;
};

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export const MAX_SEED = 0xffffffff;

function validateField(path: string, spec: FieldSpec, raw: unknown): ValidationResult<number> {
  const issue = (message: string): ValidationResult<number> => ({
    ok: false,
    issues: [{ path, message }],
  });

  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return issue(`${spec.label} must be a finite number.`);
  }

  if (spec.kind === 'seed') {
    if (!Number.isInteger(value) || value < 0 || value > MAX_SEED) {
      return issue(`${spec.label} must be an integer between 0 and ${MAX_SEED}.`);
    }
    return { ok: true, value };
  }

  if (spec.integer === true && !Number.isInteger(value)) {
    return issue(`${spec.label} must be an integer.`);
  }
  if (value < spec.min || value > spec.max) {
    return issue(`${spec.label} must be between ${spec.min} and ${spec.max}.`);
  }
  return { ok: true, value };
}

/** Default parameter object derived from a schema. Always valid by construction. */
export function defaultParams<P extends Record<string, number>>(schema: ParamSchema<P>): P {
  const out: Record<string, number> = {};
  for (const key of Object.keys(schema)) {
    out[key] = schema[key as keyof P].default;
  }
  return Object.freeze(out) as P;
}

/**
 * Validate a partial, possibly string-valued input against a schema.
 * Missing keys fall back to their default, so this doubles as a merge.
 */
export function validateParams<P extends Record<string, number>>(
  schema: ParamSchema<P>,
  input: Readonly<Record<string, unknown>> = {},
): ValidationResult<P> {
  const issues: ValidationIssue[] = [];
  const out: Record<string, number> = {};

  for (const key of Object.keys(schema)) {
    const spec = schema[key as keyof P];
    if (!(key in input) || input[key] === undefined || input[key] === null || input[key] === '') {
      out[key] = spec.default;
      continue;
    }
    const result = validateField(key, spec, input[key]);
    if (result.ok) {
      out[key] = result.value;
    } else {
      issues.push(...result.issues);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: Object.freeze(out) as P };
}

/** Validate and throw. Use in tests and in code paths where input is already trusted. */
export function parseParams<P extends Record<string, number>>(
  schema: ParamSchema<P>,
  input: Readonly<Record<string, unknown>> = {},
): P {
  const result = validateParams(schema, input);
  if (!result.ok) {
    throw new Error(
      `Invalid parameters: ${result.issues.map((i) => `${i.path}: ${i.message}`).join(' ')}`,
    );
  }
  return result.value;
}

/**
 * Clamp a value into a field's range without reporting an error.
 * Controls use this so dragging a slider can never produce invalid state.
 */
export function clampToField(spec: FieldSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.default;
  if (spec.kind === 'seed') {
    return Math.min(MAX_SEED, Math.max(0, Math.round(value)));
  }
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  return spec.integer === true ? Math.round(clamped) : clamped;
}
