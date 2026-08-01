import type { RadioactiveDecaySnapshot } from '@simulaciencia/case-radioactive-decay';
import { radioactiveDecayCase } from '@simulaciencia/case-radioactive-decay';
import { SimulationRunner } from '@simulaciencia/core';
import { createDecayScene, type RendererLike } from '@simulaciencia/visuals';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Resource-leak guard for the 3D chamber.
 *
 * jsdom has no WebGL, so the scene is built with a stub renderer through the
 * documented `rendererFactory` seam. Every geometry and material is a real
 * Three.js object, so the disposal assertions are about real resources.
 */

interface StubRenderer extends RendererLike {
  readonly renderCalls: number;
  readonly disposeCalls: number;
  readonly lastSize: { width: number; height: number };
}

function createStubRenderer(canvas: HTMLCanvasElement): StubRenderer {
  let renderCalls = 0;
  let disposeCalls = 0;
  const lastSize = { width: 0, height: 0 };
  return {
    domElement: canvas,
    setPixelRatio: () => {},
    setSize: (width: number, height: number) => {
      lastSize.width = width;
      lastSize.height = height;
    },
    render: () => {
      renderCalls += 1;
    },
    dispose: () => {
      disposeCalls += 1;
    },
    get renderCalls() {
      return renderCalls;
    },
    get disposeCalls() {
      return disposeCalls;
    },
    get lastSize() {
      return lastSize;
    },
  };
}

function makeSnapshot(steps = 40): RadioactiveDecaySnapshot {
  const runner = new SimulationRunner(radioactiveDecayCase, {
    seed: 4321,
    params: { initialCount: 120, rate: 0.5 },
  });
  runner.stepMany(steps);
  return runner.snapshot();
}

describe('createDecayScene lifecycle', () => {
  let canvas: HTMLCanvasElement;
  let renderer: StubRenderer;
  let disposeSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = createStubRenderer(canvas);
    disposeSpies = [];

    // Spy on every Three.js resource type the scene is allowed to allocate.
    for (const ctor of [THREE.BufferGeometry, THREE.Material, THREE.InstancedMesh] as unknown as {
      prototype: { dispose: () => void };
    }[]) {
      disposeSpies.push(vi.spyOn(ctor.prototype, 'dispose'));
    }
  });

  it('builds, updates, renders and resizes without a WebGL context', () => {
    const scene = createDecayScene({
      canvas,
      width: 640,
      height: 480,
      rendererFactory: () => renderer,
    });

    scene.update(makeSnapshot());
    scene.render(0.016);
    scene.render(0.016);
    scene.resize(800, 600);

    expect(renderer.renderCalls).toBe(2);
    expect(renderer.lastSize).toEqual({ width: 800, height: 600 });
    scene.dispose();
  });

  it('disposes every geometry, material, the instanced mesh and the renderer', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });
    scene.update(makeSnapshot());
    scene.render(0.016);

    const disposalsBefore = disposeSpies.reduce((sum, spy) => sum + spy.mock.calls.length, 0);
    scene.dispose();
    const disposalsAfter = disposeSpies.reduce((sum, spy) => sum + spy.mock.calls.length, 0);

    // box geometry, edges geometry, line material, sphere geometry,
    // particle material and the instanced mesh — six tracked resources.
    expect(disposalsAfter - disposalsBefore).toBeGreaterThanOrEqual(6);
    expect(renderer.disposeCalls).toBe(1);
    expect(scene.disposed).toBe(true);
  });

  it('is idempotent and inert after disposal', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });
    scene.update(makeSnapshot());

    scene.dispose();
    scene.dispose();
    expect(renderer.disposeCalls).toBe(1);

    // Late callbacks from a cancelled frame or observer must be harmless.
    const rendersBefore = renderer.renderCalls;
    scene.update(makeSnapshot());
    scene.render(0.016);
    scene.resize(100, 100);
    expect(renderer.renderCalls).toBe(rendersBefore);
  });

  it('reuses one instanced mesh when the population shrinks', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });

    const big = new SimulationRunner(radioactiveDecayCase, {
      seed: 1,
      params: { initialCount: 500, rate: 0.5 },
    }).snapshot();
    const small = new SimulationRunner(radioactiveDecayCase, {
      seed: 1,
      params: { initialCount: 100, rate: 0.5 },
    }).snapshot();

    scene.update(big);
    const meshDisposalsAfterBig = disposeSpies.reduce((s, spy) => s + spy.mock.calls.length, 0);
    scene.update(small);
    // Shrinking must not reallocate: capacity is already sufficient.
    expect(disposeSpies.reduce((s, spy) => s + spy.mock.calls.length, 0)).toBe(
      meshDisposalsAfterBig,
    );

    scene.dispose();
  });
});
