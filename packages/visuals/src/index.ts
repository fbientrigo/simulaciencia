// Interactive laboratories
export { default as InverseTransformExplorer } from './components/InverseTransformExplorer.vue';
export { default as DecayChamber3D } from './components/DecayChamber3D.vue';
export { default as PoissonCountingLab } from './components/PoissonCountingLab.vue';
export { default as PoissonDetector3D } from './components/PoissonDetector3D.vue';

// Plot and panel primitives
export { default as BrandMark } from './components/BrandMark.vue';
export { default as CdfPlot } from './components/CdfPlot.vue';
export { default as CheckList } from './components/CheckList.vue';
export { default as CountTimeline } from './components/CountTimeline.vue';
export { default as DiscreteCountChart } from './components/DiscreteCountChart.vue';
export { default as HistogramPlot } from './components/HistogramPlot.vue';
export { default as PoissonDiagnostics } from './components/PoissonDiagnostics.vue';
export { default as MappingStrip } from './components/MappingStrip.vue';
export { default as NumberControl } from './components/NumberControl.vue';
export { default as PlotFrame } from './components/PlotFrame.vue';
export { default as SurvivalPlot } from './components/SurvivalPlot.vue';

// Composables
export type { UseSimulation, UseSimulationOptions } from './composables/useSimulation.ts';
export { useInteractive, useSimulation } from './composables/useSimulation.ts';

// Plot maths
export type { Point2D, Scale } from './plot/scale.ts';
export { formatTick, formatValue, linePath, linearScale, stepPath, ticks } from './plot/scale.ts';

// Teaching stages — presentation layer only, never imported by the engine.
export type { StageFeatures, TeachingStage } from './teaching/stages.ts';
export {
  STAGE_DESCRIPTIONS,
  STAGE_FEATURES,
  STAGE_LABELS,
  TEACHING_STAGES,
  stageFeatures,
  stageIndex,
} from './teaching/stages.ts';

// Three.js scene lifecycle
export type {
  DecayScene,
  DecaySceneOptions,
  RendererFactory,
  RendererLike,
} from './three/decayScene.ts';
export { createDecayScene } from './three/decayScene.ts';
export type {
  DetectorRendererFactory,
  DetectorRendererLike,
  DetectorScene,
  DetectorSceneOptions,
} from './three/detectorScene.ts';
export { createDetectorScene } from './three/detectorScene.ts';
export { supportsWebGL2 } from './three/capabilities.ts';
export type { Disposable, DisposalRegistry } from './three/disposal.ts';
export { createDisposalRegistry } from './three/disposal.ts';
