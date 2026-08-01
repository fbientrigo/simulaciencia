// Interactive laboratories
export { default as InverseTransformExplorer } from './components/InverseTransformExplorer.vue';
export { default as DecayChamber3D } from './components/DecayChamber3D.vue';

// Plot and panel primitives
export { default as BrandMark } from './components/BrandMark.vue';
export { default as CdfPlot } from './components/CdfPlot.vue';
export { default as CheckList } from './components/CheckList.vue';
export { default as HistogramPlot } from './components/HistogramPlot.vue';
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

// Three.js scene lifecycle
export type {
  DecayScene,
  DecaySceneOptions,
  RendererFactory,
  RendererLike,
} from './three/decayScene.ts';
export { createDecayScene, supportsWebGL2 } from './three/decayScene.ts';
