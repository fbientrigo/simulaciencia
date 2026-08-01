/**
 * Teaching stages: a PRESENTATION-layer concept, deliberately not a scientific one.
 *
 * A stage says how much of a laboratory a class has earned the right to see at
 * this point in the lesson. It never changes a number. The same seed and the
 * same parameters produce the same snapshot at every stage — `scene` and
 * `diagnostics` differ only in what is drawn.
 *
 * That is why this file lives in `packages/visuals` and why `packages/core`,
 * `packages/schemas` and `cases/*` must never import it. `engine-purity.test.ts`
 * enforces the direction of that dependency.
 */

export type TeachingStage =
  'scene' | 'manual' | 'counter' | 'automatic' | 'histogram' | 'theory' | 'diagnostics';

/** Pedagogical order. Index in this array is the only ordering that exists. */
export const TEACHING_STAGES: readonly TeachingStage[] = Object.freeze([
  'scene',
  'manual',
  'counter',
  'automatic',
  'histogram',
  'theory',
  'diagnostics',
]);

/**
 * What a stage may put on screen.
 *
 * One explicit matrix, read once by the component. The alternative — scattering
 * `stage === 'histogram' || stage === 'theory' || …` through a template — is
 * how a stage silently loses a feature the lesson depends on.
 */
export interface StageFeatures {
  /** The generic detector volume. Present at every stage. */
  readonly detectorScene: boolean;
  /** The "Simular una ventana" button: one click, one observation. */
  readonly manualSampling: boolean;
  /** The numeric count K of the current window. */
  readonly count: boolean;
  /** Completed-window tally and the short history of recent counts. */
  readonly countHistory: boolean;
  /** Play, pause, step and reset. */
  readonly automaticPlayback: boolean;
  readonly speedControls: boolean;
  /** The empirical discrete histogram. */
  readonly histogram: boolean;
  /** The theoretical Poisson PMF overlay and μ = λΔt. */
  readonly theory: boolean;
  /** Mean, unbiased variance, Fano factor and their expected values. */
  readonly diagnostics: boolean;
}

const SCENE: StageFeatures = Object.freeze({
  detectorScene: true,
  manualSampling: false,
  count: false,
  countHistory: false,
  automaticPlayback: false,
  speedControls: false,
  histogram: false,
  theory: false,
  diagnostics: false,
});

const MANUAL: StageFeatures = Object.freeze({ ...SCENE, manualSampling: true });
const COUNTER: StageFeatures = Object.freeze({ ...MANUAL, count: true, countHistory: true });
const AUTOMATIC: StageFeatures = Object.freeze({
  ...COUNTER,
  automaticPlayback: true,
  speedControls: true,
});
const HISTOGRAM: StageFeatures = Object.freeze({ ...AUTOMATIC, histogram: true });
const THEORY: StageFeatures = Object.freeze({ ...HISTOGRAM, theory: true });
const DIAGNOSTICS: StageFeatures = Object.freeze({ ...THEORY, diagnostics: true });

/**
 * The feature matrix. Each stage is literally built by spreading the previous
 * one, so "the stages are cumulative" is a property of the construction rather
 * than a convention a future edit could break unnoticed.
 */
export const STAGE_FEATURES: Readonly<Record<TeachingStage, StageFeatures>> = Object.freeze({
  scene: SCENE,
  manual: MANUAL,
  counter: COUNTER,
  automatic: AUTOMATIC,
  histogram: HISTOGRAM,
  theory: THEORY,
  diagnostics: DIAGNOSTICS,
});

/** Spanish stage names, shown in the gallery selector and in captions. */
export const STAGE_LABELS: Readonly<Record<TeachingStage, string>> = Object.freeze({
  scene: 'El fenómeno',
  manual: 'Una ventana',
  counter: 'La variable aleatoria',
  automatic: 'Repetir el experimento',
  histogram: 'La distribución aparece',
  theory: 'Modelo de Poisson',
  diagnostics: 'Verificar, no sólo mirar',
});

/** Spanish one-line description of what each stage asks the class to notice. */
export const STAGE_DESCRIPTIONS: Readonly<Record<TeachingStage, string>> = Object.freeze({
  scene: 'Sólo el detector. Todavía no hay ningún número en pantalla.',
  manual: 'Un clic revela una ventana de observación. El conteo sigue oculto.',
  counter: 'Cada ventana entrega un entero no negativo K.',
  automatic: 'Repetimos el experimento muchas veces y guardamos cada conteo.',
  histogram: 'Las frecuencias observadas empiezan a dibujar una forma.',
  theory: 'Comparamos esa forma con P(K = k) para μ = λΔt.',
  diagnostics: 'Media, varianza y factor de Fano frente a lo que predice el modelo.',
});

export function stageFeatures(stage: TeachingStage): StageFeatures {
  return STAGE_FEATURES[stage];
}

/** Position of a stage in the pedagogical order. `-1` for an unknown stage. */
export function stageIndex(stage: TeachingStage): number {
  return TEACHING_STAGES.indexOf(stage);
}
