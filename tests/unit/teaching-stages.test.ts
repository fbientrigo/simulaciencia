import {
  STAGE_DESCRIPTIONS,
  STAGE_FEATURES,
  STAGE_LABELS,
  TEACHING_STAGES,
  stageFeatures,
  stageIndex,
  type StageFeatures,
  type TeachingStage,
} from '@simulaciencia/visuals';
import { describe, expect, it } from 'vitest';

/**
 * The stage matrix, tested as a matrix.
 *
 * These assertions are about the CONTRACT — what a stage promises to show —
 * rather than about markup. The DOM consequences are checked separately in
 * `poisson-components.test.ts`, so a template refactor cannot quietly redefine
 * what "the counter stage" means.
 */

const FEATURE_KEYS: readonly (keyof StageFeatures)[] = [
  'detectorScene',
  'manualSampling',
  'count',
  'countHistory',
  'automaticPlayback',
  'speedControls',
  'histogram',
  'theory',
  'diagnostics',
];

describe('teaching stages', () => {
  it('declares exactly the seven documented stages, in pedagogical order', () => {
    expect(TEACHING_STAGES).toEqual([
      'scene',
      'manual',
      'counter',
      'automatic',
      'histogram',
      'theory',
      'diagnostics',
    ]);
  });

  it('gives every stage a feature record, a Spanish label and a Spanish description', () => {
    for (const stage of TEACHING_STAGES) {
      expect(STAGE_FEATURES[stage]).toBeDefined();
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(2);
      expect(STAGE_DESCRIPTIONS[stage].length).toBeGreaterThan(10);
      expect(stageIndex(stage)).toBe(TEACHING_STAGES.indexOf(stage));
    }
  });

  it('is cumulative: no stage ever loses a feature the previous one had', () => {
    for (let i = 1; i < TEACHING_STAGES.length; i += 1) {
      const previous = stageFeatures(TEACHING_STAGES[i - 1] as TeachingStage);
      const current = stageFeatures(TEACHING_STAGES[i] as TeachingStage);
      for (const key of FEATURE_KEYS) {
        if (previous[key]) {
          expect(`${TEACHING_STAGES[i]}.${key}=${String(current[key])}`).toBe(
            `${TEACHING_STAGES[i]}.${key}=true`,
          );
        }
      }
    }
  });

  it('adds at least one new feature at every stage transition', () => {
    for (let i = 1; i < TEACHING_STAGES.length; i += 1) {
      const previous = stageFeatures(TEACHING_STAGES[i - 1] as TeachingStage);
      const current = stageFeatures(TEACHING_STAGES[i] as TeachingStage);
      const added = FEATURE_KEYS.filter((key) => current[key] && !previous[key]);
      expect(added.length).toBeGreaterThan(0);
    }
  });

  it('shows only the detector scene at the `scene` stage', () => {
    const scene = stageFeatures('scene');
    expect(scene.detectorScene).toBe(true);
    expect(scene.manualSampling).toBe(false);
    expect(scene.count).toBe(false);
    expect(scene.automaticPlayback).toBe(false);
    expect(scene.histogram).toBe(false);
    expect(scene.theory).toBe(false);
    expect(scene.diagnostics).toBe(false);
  });

  it('adds manual sampling — and only manual sampling — at the `manual` stage', () => {
    const manual = stageFeatures('manual');
    expect(manual.manualSampling).toBe(true);
    // The count stays hidden: one click reveals a window, not a number.
    expect(manual.count).toBe(false);
    expect(manual.countHistory).toBe(false);
    expect(manual.automaticPlayback).toBe(false);
  });

  it('reveals the count at the `counter` stage without automatic playback', () => {
    const counter = stageFeatures('counter');
    expect(counter.count).toBe(true);
    expect(counter.countHistory).toBe(true);
    expect(counter.automaticPlayback).toBe(false);
    expect(counter.histogram).toBe(false);
  });

  it('adds playback at the `automatic` stage while preserving manual sampling', () => {
    const automatic = stageFeatures('automatic');
    expect(automatic.automaticPlayback).toBe(true);
    expect(automatic.speedControls).toBe(true);
    expect(automatic.manualSampling).toBe(true);
    expect(automatic.histogram).toBe(false);
  });

  it('shows empirical bars but no Poisson overlay at the `histogram` stage', () => {
    const histogram = stageFeatures('histogram');
    expect(histogram.histogram).toBe(true);
    expect(histogram.theory).toBe(false);
    expect(histogram.diagnostics).toBe(false);
  });

  it('adds the theoretical overlay at the `theory` stage, still without diagnostics', () => {
    const theory = stageFeatures('theory');
    expect(theory.histogram).toBe(true);
    expect(theory.theory).toBe(true);
    expect(theory.diagnostics).toBe(false);
  });

  it('adds mean, variance and Fano only at the `diagnostics` stage', () => {
    const diagnostics = stageFeatures('diagnostics');
    expect(diagnostics.diagnostics).toBe(true);
    for (const key of FEATURE_KEYS) expect(diagnostics[key]).toBe(true);
  });

  it('freezes the matrix so a caller cannot mutate another slide out from under it', () => {
    expect(Object.isFrozen(STAGE_FEATURES)).toBe(true);
    expect(Object.isFrozen(STAGE_FEATURES.diagnostics)).toBe(true);
  });
});
