import {
  POISSON_STEP_SECONDS,
  poissonCountingCase,
  type PoissonCountingSnapshot,
} from '@simulaciencia/case-poisson-counting';
import { SimulationRunner } from '@simulaciencia/core';
import {
  PoissonCountingLab,
  PoissonDetector3D,
  createDetectorScene,
  type DetectorRendererLike,
  type DetectorScene,
  type DetectorSceneOptions,
  type TeachingStage,
} from '@simulaciencia/visuals';
import { mount } from '@vue/test-utils';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

/**
 * Component-level guarantees for the counting laboratory.
 *
 * jsdom has no WebGL and no real layout, so these cover what jsdom CAN decide:
 * which stage shows what, that a click reveals exactly one observation, that
 * reset returns to the deterministic starting frame, and that unmounting
 * releases every resource. "Does it actually paint" belongs to Playwright.
 *
 * `PoissonDetector3D` chooses between WebGL and the fallback inside
 * `onMounted`, because it needs the real canvas to do so; that decision reaches
 * the DOM on the next tick, so every mount here is followed by `await nextTick()`.
 */

function stubRenderer(canvas: HTMLCanvasElement): DetectorRendererLike {
  return {
    domElement: canvas,
    setPixelRatio: () => {},
    setSize: () => {},
    render: () => {},
    dispose: () => {},
  };
}

/** A scene backed by real Three.js objects but a fake renderer. */
function makeTestScene(options: DetectorSceneOptions): DetectorScene {
  return createDetectorScene({ ...options, rendererFactory: stubRenderer });
}

function snapshotAfter(windows: number): PoissonCountingSnapshot {
  const runner = new SimulationRunner(poissonCountingCase, {
    seed: 20260801,
    params: { rate: 3, windowDuration: 1, maxWindows: 600 },
  });
  runner.stepMany(windows);
  return runner.snapshot();
}

function labProps(stage: TeachingStage, extra: Record<string, unknown> = {}) {
  return {
    stage,
    seed: 20260801,
    rate: 3,
    windowDuration: 1,
    maxWindows: 600,
    createScene: makeTestScene,
    ...extra,
  };
}

/** A minimal, spec-shaped `MediaQueryList` stand-in with controllable `matches`. */
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

  emit(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.#listeners) listener({ matches } as MediaQueryListEvent);
  }
}

describe('PoissonCountingLab — stage gating', () => {
  it('shows only the detector and the question at the `scene` stage', () => {
    const wrapper = mount(PoissonCountingLab, { props: labProps('scene') });

    expect(wrapper.find('[data-testid="poisson-detector-shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="poisson-question"]').text()).toContain(
      '¿Cuántos eventos observaremos durante una ventana de tiempo?',
    );
    expect(wrapper.find('[data-testid="poisson-sample-window"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poisson-current-count"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poisson-toggle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="discrete-count-chart"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poisson-diagnostics"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('adds only manual sampling at the `manual` stage, still hiding the count', () => {
    const wrapper = mount(PoissonCountingLab, { props: labProps('manual') });

    const button = wrapper.find('[data-testid="poisson-sample-window"]');
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe('Simular una ventana');
    expect(wrapper.find('[data-testid="poisson-current-count"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poisson-toggle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="count-timeline"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('reveals the count and the history at the `counter` stage', () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('counter', { initialWindows: 1 }),
    });

    expect(wrapper.find('[data-testid="poisson-current-count"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="count-timeline"]').exists()).toBe(true);
    // Still no autoplay and no chart.
    expect(wrapper.find('[data-testid="poisson-toggle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="discrete-count-chart"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('offers autoplay at the `automatic` stage while keeping manual sampling', () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('automatic', { initialWindows: 5 }),
    });

    expect(wrapper.find('[data-testid="poisson-toggle"]').text()).toBe('Reproducir');
    expect(wrapper.find('[data-testid="poisson-step"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="poisson-reset"]').exists()).toBe(true);
    // The manual button survives: "do that one again" must still work.
    expect(wrapper.find('[data-testid="poisson-sample-window"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="discrete-count-chart"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('draws empirical bars but no Poisson overlay at the `histogram` stage', () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('histogram', { initialWindows: 40 }),
    });

    expect(wrapper.find('[data-testid="discrete-count-chart"]').exists()).toBe(true);
    expect(wrapper.findAll('.sc-mark-bar').length).toBeGreaterThan(5);
    expect(wrapper.find('[data-testid="poisson-pmf-curve"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poisson-expected-count"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poisson-diagnostics"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('adds the PMF overlay and μ at the `theory` stage', () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('theory', { initialWindows: 40 }),
    });

    expect(wrapper.find('[data-testid="poisson-pmf-curve"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="expected-count-rule"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="poisson-expected-count"]').text()).toBe('μ = 3.00');
    expect(wrapper.find('[data-testid="poisson-diagnostics"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('adds mean, variance and Fano at the `diagnostics` stage', () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('diagnostics', { initialWindows: 400 }),
    });

    const panel = wrapper.find('[data-testid="poisson-diagnostics"]');
    expect(panel.exists()).toBe(true);
    // Measured for seed 20260801, μ = 3, 400 windows.
    expect(wrapper.find('[data-testid="diagnostic-mean"]').text()).toBe('3.063');
    expect(wrapper.find('[data-testid="diagnostic-variance"]').text()).toBe('3.131');
    expect(wrapper.find('[data-testid="diagnostic-fano"]').text()).toBe('1.023');
    expect(wrapper.find('[data-testid="poisson-diagnostics-verdict"]').text()).toContain(
      'Verificado',
    );
    // Everything the earlier stages promised is still there.
    expect(wrapper.find('[data-testid="poisson-pmf-curve"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="poisson-sample-window"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('refuses to draw conclusions from too few observations', () => {
    // Four windows: mean and variance are arithmetically defined, so they are
    // shown — and the panel says plainly that they do not yet mean anything.
    const few = mount(PoissonCountingLab, {
      props: labProps('diagnostics', { initialWindows: 4 }),
    });
    const verdict = few.find('[data-testid="poisson-diagnostics-verdict"]');
    expect(verdict.text()).toContain('Todavía no verificado');
    expect(verdict.text()).toContain('Se necesitan al menos 30 ventanas');
    few.unmount();

    // One window: the unbiased variance and the Fano factor do not exist at
    // all, and an em dash is the honest thing to print for a number that has
    // no value rather than an unreliable one.
    const single = mount(PoissonCountingLab, {
      props: labProps('diagnostics', { initialWindows: 1 }),
    });
    expect(single.find('[data-testid="diagnostic-mean"]').text()).not.toBe('—');
    expect(single.find('[data-testid="diagnostic-variance"]').text()).toBe('—');
    expect(single.find('[data-testid="diagnostic-fano"]').text()).toBe('—');
    single.unmount();

    // Nothing observed: even the mean is undefined.
    const empty = mount(PoissonCountingLab, { props: labProps('diagnostics') });
    expect(empty.find('[data-testid="diagnostic-mean"]').text()).toBe('—');
    empty.unmount();
  });
});

describe('PoissonCountingLab — determinism and interaction', () => {
  it('reconstructs exactly the same observations from the same seed and initialWindows', () => {
    const a = mount(PoissonCountingLab, { props: labProps('theory', { initialWindows: 40 }) });
    const b = mount(PoissonCountingLab, { props: labProps('theory', { initialWindows: 40 }) });
    expect(a.html()).toBe(b.html());
    a.unmount();
    b.unmount();
  });

  it('matches the pure engine run for the same seed and window count', () => {
    const expected = snapshotAfter(40);
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('counter', { initialWindows: 40 }),
    });
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('40');
    expect(wrapper.find('[data-testid="poisson-current-count"]').text()).toBe(
      String(expected.currentCount),
    );
    wrapper.unmount();
  });

  it('renders a different picture for a different seed', () => {
    const a = mount(PoissonCountingLab, { props: labProps('theory', { initialWindows: 40 }) });
    const b = mount(PoissonCountingLab, {
      props: labProps('theory', { initialWindows: 40, seed: 987654 }),
    });
    expect(a.html()).not.toBe(b.html());
    a.unmount();
    b.unmount();
  });

  it('adds exactly one observation per manual click', async () => {
    const wrapper = mount(PoissonCountingLab, { props: labProps('counter') });
    const button = wrapper.find('[data-testid="poisson-sample-window"]');

    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('0');
    for (let i = 1; i <= 4; i += 1) {
      await button.trigger('click');
      expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe(String(i));
    }

    // And the counts match the engine exactly.
    expect(wrapper.find('[data-testid="poisson-history-tail"]').text()).toBe(
      snapshotAfter(4).countHistory.join(' · '),
    );
    wrapper.unmount();
  });

  it('starts autoplay only where the stage offers it, and can be paused', async () => {
    const noPlayback = mount(PoissonCountingLab, { props: labProps('manual', { autoplay: true }) });
    await nextTick();
    // No transport at all on the manual stage, so autoplay has nothing to start.
    expect(noPlayback.find('[data-testid="poisson-toggle"]').exists()).toBe(false);
    noPlayback.unmount();

    const wrapper = mount(PoissonCountingLab, {
      props: labProps('automatic', { autoplay: true }),
      attachTo: document.body,
    });
    await nextTick();

    const toggle = wrapper.find('[data-testid="poisson-toggle"]');
    expect(toggle.text()).toBe('Pausar');
    await toggle.trigger('click');
    expect(wrapper.find('[data-testid="poisson-toggle"]').text()).toBe('Reproducir');

    wrapper.unmount();
  });

  it('restores the deterministic initial state on reset', async () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('automatic', { initialWindows: 5 }),
    });
    const initialHistory = wrapper.find('[data-testid="poisson-history-tail"]').text();
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('5');

    await wrapper.find('[data-testid="poisson-sample-window"]').trigger('click');
    await wrapper.find('[data-testid="poisson-sample-window"]').trigger('click');
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('7');

    await wrapper.find('[data-testid="poisson-reset"]').trigger('click');
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('5');
    expect(wrapper.find('[data-testid="poisson-history-tail"]').text()).toBe(initialHistory);

    wrapper.unmount();
  });

  it('drops interactive controls in the two capture modes', () => {
    for (const mode of ['social-h', 'social-v'] as const) {
      const wrapper = mount(PoissonCountingLab, {
        props: labProps('diagnostics', { initialWindows: 400, mode }),
      });
      expect(wrapper.find('[data-testid="poisson-sample-window"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="poisson-toggle"]').exists()).toBe(false);
      // The science stays: chart, overlay and diagnostics are all still drawn.
      expect(wrapper.find('[data-testid="poisson-pmf-curve"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="poisson-diagnostics"]').exists()).toBe(true);
      wrapper.unmount();
    }
  });

  it('renders in the slide and embed modes with the frame class the mode asks for', () => {
    for (const mode of ['slide', 'embed'] as const) {
      const wrapper = mount(PoissonCountingLab, {
        props: labProps('theory', { initialWindows: 40, mode }),
      });
      expect(wrapper.find('[data-testid="poisson-counting-lab"]').classes()).toContain(
        `sc-frame--${mode}`,
      );
      wrapper.unmount();
    }
  });
});

describe('PoissonDetector3D — renderer paths', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mounts the WebGL path when a WebGL 2 context is available', async () => {
    vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );
    const scenes: DetectorScene[] = [];

    const wrapper = mount(PoissonDetector3D, {
      props: {
        snapshot: snapshotAfter(3),
        createScene: (options: DetectorSceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
    await nextTick();

    expect(scenes).toHaveLength(1);
    expect(wrapper.find('[data-testid="poisson-detector-canvas"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="poisson-detector-fallback"]').exists()).toBe(false);

    wrapper.unmount();
    expect(scenes[0]!.disposed).toBe(true);
  });

  it('renders the 2D fallback when WebGL 2 is missing, with the same events', async () => {
    // jsdom's `getContext` returns undefined, so this is the natural path here.
    const snapshot = snapshotAfter(3);
    const wrapper = mount(PoissonDetector3D, {
      props: { snapshot },
      attachTo: document.body,
    });
    await nextTick();

    const fallback = wrapper.find('[data-testid="poisson-detector-fallback"]');
    expect(fallback.exists()).toBe(true);
    expect(fallback.attributes('aria-label')).toContain('Proyección bidimensional del detector');
    expect(fallback.text()).toContain('WebGL 2 no está disponible');
    // One dot per event of the current window — the statistics are untouched.
    expect(wrapper.findAll('.sc-mark-point')).toHaveLength(snapshot.currentEvents.length);

    wrapper.unmount();
  });

  it('honours forceFallback even where WebGL 2 works', async () => {
    vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );
    const wrapper = mount(PoissonDetector3D, {
      props: { snapshot: snapshotAfter(3), forceFallback: true, createScene: makeTestScene },
      attachTo: document.body,
    });
    await nextTick();
    expect(wrapper.find('[data-testid="poisson-detector-fallback"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('cancels its animation frame and removes its listeners on unmount', async () => {
    vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const mediaQueryList = new FakeMediaQueryList(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQueryList),
    );

    const wrapper = mount(PoissonDetector3D, {
      props: { snapshot: snapshotAfter(3), createScene: makeTestScene },
      attachTo: document.body,
    });
    await nextTick();
    expect(mediaQueryList.listenerCount).toBe(1);

    wrapper.unmount();
    expect(mediaQueryList.listenerCount).toBe(0);
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('PoissonDetector3D — reduced motion', () => {
  let mediaQueryList: FakeMediaQueryList;

  function stubMatchMedia(initialMatches: boolean): void {
    mediaQueryList = new FakeMediaQueryList(initialMatches);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQueryList),
    );
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

  function mountDetector(scenes: DetectorScene[]) {
    return mount(PoissonDetector3D, {
      props: {
        snapshot: snapshotAfter(3),
        createScene: (options: DetectorSceneOptions) => {
          const scene = makeTestScene(options);
          scenes.push(scene);
          return scene;
        },
      },
      attachTo: document.body,
    });
  }

  it('orbits and animates the reveal when no preference is set', async () => {
    stubMatchMedia(false);
    const scenes: DetectorScene[] = [];
    const wrapper = mountDetector(scenes);
    await nextTick();

    expect(scenes[0]!.spinRate).toBeGreaterThan(0);
    expect(scenes[0]!.instantReveal).toBe(false);
    wrapper.unmount();
  });

  it('removes decoration only when reduced motion is requested', async () => {
    stubMatchMedia(true);
    const scenes: DetectorScene[] = [];
    const wrapper = mountDetector(scenes);
    await nextTick();

    // Decoration off …
    expect(scenes[0]!.spinRate).toBe(0);
    expect(scenes[0]!.instantReveal).toBe(true);
    // … but the observation is fully revealed rather than skipped.
    expect(scenes[0]!.revealProgress).toBe(1);
    wrapper.unmount();
  });

  it('follows a live change of the OS preference in both directions', async () => {
    stubMatchMedia(false);
    const scenes: DetectorScene[] = [];
    const wrapper = mountDetector(scenes);
    await nextTick();

    mediaQueryList.emit(true);
    await nextTick();
    expect(scenes[0]!.spinRate).toBe(0);
    expect(scenes[0]!.instantReveal).toBe(true);

    mediaQueryList.emit(false);
    await nextTick();
    expect(scenes[0]!.spinRate).toBeGreaterThan(0);
    expect(scenes[0]!.instantReveal).toBe(false);

    wrapper.unmount();
  });

  it('never disables manual sampling under reduced motion', async () => {
    stubMatchMedia(true);
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('counter'),
      attachTo: document.body,
    });
    await nextTick();

    await wrapper.find('[data-testid="poisson-sample-window"]').trigger('click');
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('1');

    wrapper.unmount();
  });
});

describe('createDetectorScene lifecycle', () => {
  let canvas: HTMLCanvasElement;
  let renderer: DetectorRendererLike;
  let disposeSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = stubRenderer(canvas);
    disposeSpies = [];
    for (const ctor of [THREE.BufferGeometry, THREE.Material, THREE.InstancedMesh] as unknown as {
      prototype: { dispose: () => void };
    }[]) {
      disposeSpies.push(vi.spyOn(ctor.prototype, 'dispose'));
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds, updates, renders and resizes without a WebGL context', () => {
    const renderSpy = vi.spyOn(renderer, 'render');
    const scene = createDetectorScene({
      canvas,
      width: 640,
      height: 480,
      rendererFactory: () => renderer,
    });

    scene.update(snapshotAfter(5));
    scene.render(0.016);
    scene.render(0.016);
    scene.resize(800, 600);

    expect(renderSpy).toHaveBeenCalledTimes(2);
    scene.dispose();
  });

  it('disposes every tracked geometry, material, instanced mesh and the renderer', () => {
    const disposeSpy = vi.spyOn(renderer, 'dispose');
    const scene = createDetectorScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });
    scene.update(snapshotAfter(5));
    scene.render(0.016);

    const before = disposeSpies.reduce((sum, spy) => sum + spy.mock.calls.length, 0);
    scene.dispose();
    const after = disposeSpies.reduce((sum, spy) => sum + spy.mock.calls.length, 0);

    // volume box, volume edges, volume material, source geometry, source
    // material, track geometry, track material, flash geometry, flash material
    // and the instanced mesh — ten tracked resources.
    expect(after - before).toBeGreaterThanOrEqual(10);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(scene.disposed).toBe(true);
  });

  it('is idempotent and inert after disposal', () => {
    const disposeSpy = vi.spyOn(renderer, 'dispose');
    const renderSpy = vi.spyOn(renderer, 'render');
    const scene = createDetectorScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });
    scene.update(snapshotAfter(5));

    scene.dispose();
    scene.dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    // Late callbacks from a cancelled frame or observer must be harmless.
    const rendersBefore = renderSpy.mock.calls.length;
    scene.update(snapshotAfter(6));
    scene.render(0.016);
    scene.resize(100, 100);
    scene.setSpinRate(2);
    scene.setInstantReveal(true);
    expect(renderSpy.mock.calls.length).toBe(rendersBefore);
  });

  it('plays the reveal forward in time and reaches a complete window', () => {
    const scene = createDetectorScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
    });
    scene.update(snapshotAfter(5));
    expect(scene.revealProgress).toBe(0);

    for (let i = 0; i < 60; i += 1) scene.render(0.02);
    expect(scene.revealProgress).toBe(1);

    // A new window restarts the reveal; the same window does not.
    scene.update(snapshotAfter(6));
    expect(scene.revealProgress).toBe(0);
    scene.update(snapshotAfter(6));
    expect(scene.revealProgress).toBe(0);

    scene.dispose();
  });

  it('shows a reduced-motion window complete from the first frame', () => {
    const scene = createDetectorScene({
      canvas,
      width: 320,
      height: 240,
      rendererFactory: () => renderer,
      instantReveal: true,
    });
    scene.update(snapshotAfter(5));
    expect(scene.revealProgress).toBe(1);
    scene.dispose();
  });
});

describe('PoissonCountingLab — playback time is not physical time', () => {
  it('converts initialWindows to simulation time through the case step, not by guessing', () => {
    const wrapper = mount(PoissonCountingLab, {
      props: labProps('counter', { initialWindows: 12, windowDuration: 1.5 }),
    });
    // 12 windows of pedagogical playback …
    expect(wrapper.find('[data-testid="poisson-revealed-windows"]').text()).toBe('12');
    // … and 18 units of physical exposure, reported separately.
    expect(wrapper.find('[data-testid="poisson-counting-lab"]').text()).toContain(
      'exposición total = 18.00',
    );
    expect(12 * POISSON_STEP_SECONDS).toBe(3);
    wrapper.unmount();
  });
});
