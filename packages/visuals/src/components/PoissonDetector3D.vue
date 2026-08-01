<script setup lang="ts">
import type { PoissonCountingSnapshot } from '@simulaciencia/case-poisson-counting';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { supportsWebGL2 } from '../three/capabilities.ts';
import {
  createDetectorScene,
  type DetectorScene,
  type DetectorSceneOptions,
} from '../three/detectorScene.ts';

/**
 * A generic counting detector: a source, a bounded sensitive volume, and a
 * flash wherever a particle interacts.
 *
 * It is abstract on purpose. It is not a reactor, not a beamline and not a
 * collider experiment, because the mathematics on the next slide applies just
 * as well to photons on a photomultiplier, calls arriving at a switchboard, or
 * typos on a page. Anything that made this look like one specific apparatus
 * would narrow the lesson.
 *
 * The component owns the animation frame; the engine owns time. The render loop
 * runs whether or not the simulation is playing — it drives the reveal of the
 * current window and the idle camera — and it never advances the model.
 *
 * Every learner-visible string here is Spanish.
 */
const props = withDefaults(
  defineProps<{
    // `| undefined` throughout: the workspace runs with
    // `exactOptionalPropertyTypes`, and callers legitimately forward an
    // optional value rather than omitting the attribute.
    snapshot: PoissonCountingSnapshot;
    /** Show the live count on the canvas overlay. Hidden before the counter stage. */
    showCount?: boolean | undefined;
    /** Render the 2D fallback even where WebGL 2 works. Used by tests and docs. */
    forceFallback?: boolean | undefined;
    /** Freeze the idle camera, e.g. for a pixel-stable capture. */
    freeze?: boolean | undefined;
    /** Scene factory seam. Tests inject a stub renderer; production uses WebGL. */
    createScene?: ((options: DetectorSceneOptions) => DetectorScene) | undefined;
  }>(),
  { showCount: false, forceFallback: false, freeze: false },
);

const IDLE_SPIN_RATE = 0.1;

const shell = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
/** null until mount decides; true means "3D is running". */
const webglReady = ref<boolean | null>(null);

/**
 * Tracks the OS-level `prefers-reduced-motion` setting. Starts `false` (full
 * motion) so environments without `matchMedia` — SSR, some test harnesses —
 * get the default behaviour rather than a frozen scene.
 */
const prefersReducedMotion = ref(false);

/**
 * Reduced motion removes DECORATION only:
 *  - the idle camera orbit stops;
 *  - a new window appears fully formed instead of particles flying in.
 *
 * What it never touches: which events exist, where they are, the count, the
 * histogram, the diagnostics, or the ability to click "Simular una ventana".
 * Every statistical change still happens, and still happens on the same click.
 */
const idleSpinRate = computed(() =>
  props.freeze || prefersReducedMotion.value ? 0 : IDLE_SPIN_RATE,
);
const instantReveal = computed(() => prefersReducedMotion.value);

let scene: DetectorScene | null = null;
let frameHandle: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let motionQuery: MediaQueryList | null = null;
let lastFrameTime = 0;

function handleMotionPreferenceChange(event: MediaQueryListEvent): void {
  prefersReducedMotion.value = event.matches;
}

function renderFrame(timestamp: number): void {
  if (scene === null) return;
  const elapsed = lastFrameTime === 0 ? 0 : (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  // Purely visual: drives the reveal of the current window and the idle camera.
  scene.render(Math.min(elapsed, 0.25));
  frameHandle = requestAnimationFrame(renderFrame);
}

function teardown(): void {
  if (frameHandle !== null) {
    cancelAnimationFrame(frameHandle);
    frameHandle = null;
  }
  if (resizeObserver !== null) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (motionQuery !== null) {
    motionQuery.removeEventListener('change', handleMotionPreferenceChange);
    motionQuery = null;
  }
  if (scene !== null) {
    scene.dispose();
    scene = null;
  }
  lastFrameTime = 0;
}

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.value = motionQuery.matches;
    motionQuery.addEventListener('change', handleMotionPreferenceChange);
  }

  if (props.forceFallback || !supportsWebGL2()) {
    webglReady.value = false;
    return;
  }

  const shellElement = shell.value;
  const canvasElement = canvas.value;
  if (shellElement === null || canvasElement === null) {
    webglReady.value = false;
    return;
  }

  const rect = shellElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width) || 640);
  const height = Math.max(1, Math.round(rect.height) || 480);

  try {
    const factory = props.createScene ?? createDetectorScene;
    scene = factory({
      canvas: canvasElement,
      width,
      height,
      pixelRatio: Math.min(globalThis.devicePixelRatio ?? 1, 2),
      spinRate: idleSpinRate.value,
      instantReveal: instantReveal.value,
    });
  } catch {
    // A context that reports webgl2 but fails to initialise is a fallback
    // case, not a crash.
    webglReady.value = false;
    return;
  }

  webglReady.value = true;
  scene.update(props.snapshot);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined || scene === null) return;
      scene.resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(shellElement);
  }

  frameHandle = requestAnimationFrame(renderFrame);
});

onBeforeUnmount(teardown);

watch(idleSpinRate, (rate) => scene?.setSpinRate(rate));
watch(instantReveal, (instant) => scene?.setInstantReveal(instant));
watch(
  () => props.snapshot,
  (next) => scene?.update(next),
);

/* ---- 2D fallback --------------------------------------------------------- */

const FALLBACK_WIDTH = 300;
const FALLBACK_HEIGHT = 240;

/** Orthographic x–y projection, depth-sorted so nearer events draw last. */
const fallbackEvents = computed(() =>
  [...props.snapshot.currentEvents]
    .sort((a, b) => a.z - b.z)
    .map((event) => ({
      id: event.id,
      cx: ((event.x + 1) / 2) * FALLBACK_WIDTH,
      cy: ((1 - event.y) / 2) * FALLBACK_HEIGHT,
      r: 3 + (event.z + 1) * 1.1,
    })),
);

const fallbackLabel = computed(
  () =>
    `Proyección bidimensional del detector: ${props.snapshot.currentCount} ` +
    `${props.snapshot.currentCount === 1 ? 'interacción' : 'interacciones'} en la ventana actual.`,
);
</script>

<template>
  <div
    ref="shell"
    class="sc-canvas-shell"
    :class="{ 'sc-canvas-shell--flat': webglReady === false }"
    data-testid="poisson-detector-shell"
  >
    <canvas
      v-show="webglReady === true"
      ref="canvas"
      data-testid="poisson-detector-canvas"
      aria-label="Detector de conteo en tres dimensiones"
    />

    <div
      v-if="webglReady === false"
      class="sc-fallback"
      data-testid="poisson-detector-fallback"
      role="img"
      :aria-label="fallbackLabel"
    >
      <svg
        class="sc-plot"
        :viewBox="`0 0 ${FALLBACK_WIDTH} ${FALLBACK_HEIGHT}`"
        :style="{ maxWidth: `${FALLBACK_WIDTH}px` }"
      >
        <rect
          class="sc-plot__surface"
          x="1"
          y="1"
          :width="FALLBACK_WIDTH - 2"
          :height="FALLBACK_HEIGHT - 2"
        />
        <!-- The entry surface, on the left edge, mirroring the 3D scene. -->
        <line
          class="sc-mark-rule"
          x1="6"
          x2="6"
          :y1="FALLBACK_HEIGHT * 0.15"
          :y2="FALLBACK_HEIGHT * 0.85"
        />
        <line
          v-for="event in fallbackEvents"
          :key="`track-${event.id}`"
          class="sc-mark-link"
          x1="6"
          :y1="FALLBACK_HEIGHT / 2"
          :x2="event.cx"
          :y2="event.cy"
        />
        <circle
          v-for="event in fallbackEvents"
          :key="`hit-${event.id}`"
          class="sc-mark-point"
          :cx="event.cx"
          :cy="event.cy"
          :r="event.r"
        />
      </svg>
      <p class="sc-hint">
        WebGL 2 no está disponible, así que el detector se muestra como una proyección plana. La
        simulación no cambia: nunca dependió del motor de dibujo. Las
        {{ snapshot.currentEvents.length }} interacciones de esta ventana son exactamente las
        mismas.
      </p>
    </div>

    <div v-if="webglReady === true && showCount" class="sc-canvas-overlay">
      <span>K = {{ snapshot.currentCount }}</span>
      <span>ventana {{ snapshot.revealedWindows }}</span>
    </div>
  </div>
</template>

<style scoped>
.sc-canvas-shell {
  aspect-ratio: 5 / 4;
}

/* The 3D path owns a canvas whose size the shell has to decide. The flat path
 * owns an SVG plus a paragraph explaining why it is there, and forcing that
 * into a 5:4 box is what clips the explanation exactly when the reader most
 * needs it. */
.sc-canvas-shell--flat {
  aspect-ratio: auto;
}
</style>
