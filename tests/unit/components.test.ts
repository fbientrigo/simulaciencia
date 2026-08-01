import {
  DecayChamber3D,
  InverseTransformExplorer,
  createDecayScene,
  type DecayScene,
  type DecaySceneOptions,
  type RendererLike,
} from '@simulaciencia/visuals';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

/**
 * Component-level guarantees.
 *
 * jsdom has no WebGL and no real layout, so these tests cover what jsdom CAN
 * decide: that the fallback appears, that the same seed yields the same DOM,
 * that controls drive the engine, and that unmounting releases everything.
 * The "does it actually paint" question belongs to the Playwright smoke test.
 *
 * `DecayChamber3D` decides between WebGL and the fallback inside `onMounted`,
 * because it needs the real canvas element to do so. That decision reaches the
 * DOM on the next tick, so every mount here is followed by `await nextTick()`.
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

/** A scene backed by real Three.js objects but a fake renderer. */
function makeTestScene(options: DecaySceneOptions): DecayScene {
  return createDecayScene({ ...options, rendererFactory: stubRenderer });
}

describe('InverseTransformExplorer', () => {
  it('renders the same DOM twice for the same seed and parameters', () => {
    const props = { seed: 123, rate: 1.5, sampleCount: 200, revealAll: true } as const;
    const first = mount(InverseTransformExplorer, { props });
    const second = mount(InverseTransformExplorer, { props });
    expect(first.html()).toBe(second.html());
    first.unmount();
    second.unmount();
  });

  it('renders different DOM for a different seed', () => {
    const a = mount(InverseTransformExplorer, {
      props: { seed: 1, rate: 1.5, sampleCount: 200, revealAll: true },
    });
    const b = mount(InverseTransformExplorer, {
      props: { seed: 2, rate: 1.5, sampleCount: 200, revealAll: true },
    });
    expect(a.html()).not.toBe(b.html());
    a.unmount();
    b.unmount();
  });

  it('shows the theoretical mean 1/λ and a matching empirical mean', () => {
    const wrapper = mount(InverseTransformExplorer, {
      props: { seed: 42, rate: 2, sampleCount: 4000, revealAll: true },
    });
    const rows = wrapper.findAll('.sc-stats tbody tr');
    const meanRow = rows[0]?.findAll('td') ?? [];
    expect(meanRow[0]?.text()).toBe('0.500'); // 1/λ
    expect(Number(meanRow[1]?.text())).toBeCloseTo(0.5, 1);
    wrapper.unmount();
  });

  it('reveals one draw per step in step-by-step mode', async () => {
    const wrapper = mount(InverseTransformExplorer, {
      props: { seed: 9, rate: 1, sampleCount: 50 },
    });
    expect(wrapper.text()).toContain('0 / 50 drawn');

    const stepButton = wrapper.findAll('button').find((b) => b.text() === 'Step one draw');
    expect(stepButton).toBeDefined();

    await stepButton!.trigger('click');
    expect(wrapper.text()).toContain('1 / 50 drawn');
    await stepButton!.trigger('click');
    expect(wrapper.text()).toContain('2 / 50 drawn');

    const drawAll = wrapper.findAll('button').find((b) => b.text() === 'Draw all');
    await drawAll!.trigger('click');
    expect(wrapper.text()).toContain('50 / 50 drawn');
    wrapper.unmount();
  });

  it('resets back to zero draws', async () => {
    const wrapper = mount(InverseTransformExplorer, {
      props: { seed: 9, rate: 1, sampleCount: 50, revealAll: true },
    });
    expect(wrapper.text()).toContain('50 / 50 drawn');
    const reset = wrapper.findAll('button').find((b) => b.text() === 'Reset');
    await reset!.trigger('click');
    expect(wrapper.text()).toContain('0 / 50 drawn');
    wrapper.unmount();
  });

  it('hides interactive controls in capture modes', () => {
    const capture = mount(InverseTransformExplorer, {
      props: { seed: 5, mode: 'social-v', revealAll: true },
    });
    expect(capture.findAll('button')).toHaveLength(0);
    expect(capture.classes()).toContain('sc-frame--social-v');
    capture.unmount();
  });

  it('draws a histogram and both theoretical curves', () => {
    const wrapper = mount(InverseTransformExplorer, {
      props: { seed: 3, sampleCount: 500, revealAll: true },
    });
    expect(wrapper.findAll('.sc-mark-bar').length).toBeGreaterThan(5);
    expect(wrapper.findAll('.sc-mark-curve').length).toBeGreaterThanOrEqual(2);
    wrapper.unmount();
  });
});

describe('DecayChamber3D', () => {
  beforeEach(() => {
    // jsdom reports no webgl2 context, which is the fallback path by design.
    vi.stubGlobal('ResizeObserver', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the 2D fallback when WebGL 2 is unavailable', async () => {
    const wrapper = mount(DecayChamber3D, { props: { seed: 7, initialCount: 80 } });
    await nextTick();
    expect(wrapper.find('[data-testid="decay-fallback"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('WebGL 2 is unavailable');
    // The fallback is genuinely useful: one circle per simulated object.
    expect(wrapper.findAll('[data-testid="decay-fallback"] circle')).toHaveLength(80);
    wrapper.unmount();
  });

  it('still reports the survivor count and the survival curve in fallback mode', async () => {
    const wrapper = mount(DecayChamber3D, { props: { seed: 7, initialCount: 100, rate: 0.5 } });
    await nextTick();
    expect(wrapper.text()).toContain('100 / 100 remaining');
    const step = wrapper.findAll('button').find((b) => b.text() === 'Step');
    for (let i = 0; i < 60; i += 1) await step!.trigger('click');
    const remaining = Number(/(\d+) \/ 100 remaining/.exec(wrapper.text())?.[1]);
    expect(remaining).toBeLessThan(100);
    expect(wrapper.findAll('.sc-mark-curve').length).toBeGreaterThanOrEqual(2);
    wrapper.unmount();
  });

  it('produces identical markup for the same seed', async () => {
    const props = { seed: 2468, initialCount: 60, rate: 0.6 } as const;
    const a = mount(DecayChamber3D, { props });
    const b = mount(DecayChamber3D, { props });
    await nextTick();
    expect(a.html()).toBe(b.html());
    a.unmount();
    b.unmount();
  });

  it('disposes the injected scene and cancels its frame loop on unmount', async () => {
    // Give the component a working "WebGL" path through the scene seam.
    const scenes: DecayScene[] = [];
    const createScene = (options: DecaySceneOptions): DecayScene => {
      const scene = makeTestScene(options);
      scenes.push(scene);
      return scene;
    };

    const canvasProto = globalThis.HTMLCanvasElement.prototype;
    const getContext = vi
      .spyOn(canvasProto, 'getContext')
      .mockReturnValue({} as unknown as RenderingContext);

    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    const wrapper = mount(DecayChamber3D, {
      props: { seed: 11, initialCount: 50, rate: 0.5, createScene },
      attachTo: document.body,
    });

    await nextTick();
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.disposed).toBe(false);
    expect(wrapper.find('[data-testid="decay-fallback"]').exists()).toBe(false);

    wrapper.unmount();

    expect(scenes[0]!.disposed).toBe(true);
    expect(cancelSpy).toHaveBeenCalled();

    getContext.mockRestore();
  });

  it('disconnects its ResizeObserver on unmount', async () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );
    vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );

    const wrapper = mount(DecayChamber3D, {
      props: { seed: 3, initialCount: 40, createScene: makeTestScene },
      attachTo: document.body,
    });
    await nextTick();
    expect(observe).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('hides controls in capture mode but keeps the visualization', async () => {
    const wrapper = mount(DecayChamber3D, {
      props: { seed: 4, initialCount: 40, mode: 'social-h' },
    });
    await nextTick();
    expect(wrapper.findAll('button')).toHaveLength(0);
    expect(wrapper.find('[data-testid="decay-chamber-shell"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
