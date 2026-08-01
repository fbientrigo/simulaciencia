import { radioactiveDecayCase } from '@simulaciencia/case-radioactive-decay';
import type { RadioactiveDecaySnapshot } from '@simulaciencia/case-radioactive-decay';
import { SimulationRunner } from '@simulaciencia/core';
import {
  DecayChamber3D,
  createDecayScene,
  type DecayScene,
  type DecaySceneOptions,
  type RendererLike,
} from '@simulaciencia/visuals';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

/**
 * `prefers-reduced-motion` must disable exactly one thing: the decay
 * chamber's cosmetic idle camera orbit. It must never reach the engine
 * (`packages/core` and `cases/*` have no browser dependency at all — see
 * `engine-purity.test.ts`) and it must never touch the simulation's own
 * play/pause/step loop, which is scientifically meaningful and stays
 * driven by `useSimulation` regardless of this preference.
 *
 * jsdom does not implement `matchMedia` (confirmed: `typeof window.matchMedia`
 * is `'undefined'` here), so every test below supplies its own fake and tears
 * it down afterwards.
 */

function stubRenderer(canvas: HTMLCanvasElement): RendererLike {
  return {
    domElement: canvas,
    setPixelRatio: () => {},
    setSize: () => {},
    render: () => {},
    dispose: () => {},
  };
}

function makeTestScene(options: DecaySceneOptions): DecayScene {
  return createDecayScene({ ...options, rendererFactory: stubRenderer });
}

function makeSnapshot(): RadioactiveDecaySnapshot {
  const runner = new SimulationRunner(radioactiveDecayCase, {
    seed: 1,
    params: { initialCount: 40, rate: 0.5 },
  });
  runner.stepMany(10);
  return runner.snapshot();
}

/** A minimal, spec-shaped `MediaQueryList` stand-in with a controllable `matches`. */
class FakeMediaQueryList {
  matches: boolean;
  readonly #listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(type: string, listener: (event: MediaQueryListEvent) => void): void {
    if (type === 'change') this.#listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MediaQueryListEvent) => void): void {
    if (type === 'change') this.#listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.#listeners.size;
  }

  /** Simulate the OS setting changing while the page is open. */
  emit(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.#listeners) {
      listener({ matches } as MediaQueryListEvent);
    }
  }
}

describe('createDecayScene idle orbit', () => {
  let canvas: HTMLCanvasElement;
  let renderer: RendererLike;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = stubRenderer(canvas);
  });

  it('is enabled by default with a nonzero spin rate', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });
    expect(scene.spinRate).toBeGreaterThan(0);
    scene.dispose();
  });

  it('moves the camera between frames while the spin rate is nonzero', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
      spinRate: 0.5,
    });
    const renderSpy = vi.spyOn(renderer, 'render');
    scene.update(makeSnapshot());

    scene.render(1);
    const [, camera] = renderSpy.mock.calls[0] as Parameters<RendererLike['render']>;
    const first = { ...camera.position };

    scene.render(1);
    const second = { ...camera.position };

    expect(second).not.toEqual(first);
    scene.dispose();
  });

  it('freezes the camera once the spin rate is set to zero', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
      spinRate: 0.5,
    });
    const renderSpy = vi.spyOn(renderer, 'render');
    scene.update(makeSnapshot());

    scene.setSpinRate(0);
    expect(scene.spinRate).toBe(0);

    scene.render(1);
    const [, camera] = renderSpy.mock.calls[0] as Parameters<RendererLike['render']>;
    const first = { ...camera.position };

    scene.render(1);
    const second = { ...camera.position };

    expect(second).toEqual(first);
    scene.dispose();
  });

  it('ignores setSpinRate after dispose', () => {
    const scene = createDecayScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
      spinRate: 0.5,
    });
    scene.dispose();
    scene.setSpinRate(9);
    expect(scene.spinRate).toBe(0.5);
  });
});

describe('DecayChamber3D reduced-motion integration', () => {
  let mediaQueryList: FakeMediaQueryList;
  let matchMediaSpy: ReturnType<typeof vi.fn>;

  function stubMatchMedia(initialMatches: boolean): void {
    mediaQueryList = new FakeMediaQueryList(initialMatches);
    matchMediaSpy = vi.fn(() => mediaQueryList);
    vi.stubGlobal('matchMedia', matchMediaSpy);
  }

  beforeEach(() => {
    vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('enables the idle orbit normally, when no reduced-motion preference is set', async () => {
    stubMatchMedia(false);
    const scenes: DecayScene[] = [];

    const wrapper = mount(DecayChamber3D, {
      props: {
        seed: 1,
        initialCount: 30,
        createScene: (options: DecaySceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.spinRate).toBeGreaterThan(0);

    wrapper.unmount();
  });

  it('disables the idle orbit when the preference is already set at mount', async () => {
    stubMatchMedia(true);
    const scenes: DecayScene[] = [];

    const wrapper = mount(DecayChamber3D, {
      props: {
        seed: 1,
        initialCount: 30,
        createScene: (options: DecaySceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(scenes[0]!.spinRate).toBe(0);

    wrapper.unmount();
  });

  it('disables the idle orbit live when the OS preference changes while mounted', async () => {
    stubMatchMedia(false);
    const scenes: DecayScene[] = [];

    const wrapper = mount(DecayChamber3D, {
      props: {
        seed: 1,
        initialCount: 30,
        createScene: (options: DecaySceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
    await nextTick();
    expect(scenes[0]!.spinRate).toBeGreaterThan(0);

    mediaQueryList.emit(true);
    await nextTick();
    expect(scenes[0]!.spinRate).toBe(0);

    // And it can turn back on, since this tracks the live OS setting.
    mediaQueryList.emit(false);
    await nextTick();
    expect(scenes[0]!.spinRate).toBeGreaterThan(0);

    wrapper.unmount();
  });

  it('keeps a frozen capture frame still even without a reduced-motion preference', async () => {
    stubMatchMedia(false);
    const scenes: DecayScene[] = [];

    const wrapper = mount(DecayChamber3D, {
      props: {
        seed: 1,
        initialCount: 30,
        freezeAtTime: 2,
        createScene: (options: DecaySceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(scenes[0]!.spinRate).toBe(0);
    wrapper.unmount();
  });

  it('removes the media-query listener on unmount', async () => {
    stubMatchMedia(false);

    const wrapper = mount(DecayChamber3D, {
      props: { seed: 1, initialCount: 30, createScene: makeTestScene },
      attachTo: document.body,
    });
    await nextTick();

    expect(mediaQueryList.listenerCount).toBe(1);
    wrapper.unmount();
    expect(mediaQueryList.listenerCount).toBe(0);
  });

  it('never disables manual interaction or the simulation itself', async () => {
    stubMatchMedia(true); // reduced motion active
    const scenes: DecayScene[] = [];

    const wrapper = mount(DecayChamber3D, {
      props: {
        seed: 1,
        initialCount: 30,
        createScene: (options: DecaySceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
    await nextTick();
    expect(scenes[0]!.spinRate).toBe(0);

    // The camera orbit is off, but stepping the simulation is untouched.
    // Assert on simulation time, not the survivor count: at rate 0.5 none of
    // 30 particles is guaranteed to decay within one 0.02 s step, but the
    // clock advancing by exactly one fixed step is guaranteed regardless.
    const stepButton = wrapper.findAll('button').find((b) => b.text() === 'Step');
    expect(stepButton).toBeDefined();
    expect(wrapper.text()).toContain('t = 0.00s');
    await stepButton!.trigger('click');
    expect(wrapper.text()).toContain('t = 0.02s');

    wrapper.unmount();
  });
});
