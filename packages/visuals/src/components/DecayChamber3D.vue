<script setup lang="ts">
import {
  radioactiveDecayCase,
  type RadioactiveDecayParams,
  type RadioactiveDecaySnapshot,
} from '@simulaciencia/case-radioactive-decay';
import type { SeedFieldSpec } from '@simulaciencia/schemas';
import type { DisplayMode } from '@simulaciencia/theme';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSimulation } from '../composables/useSimulation.ts';
import { formatValue } from '../plot/scale.ts';
import {
  createDecayScene,
  supportsWebGL2,
  type DecayScene,
  type DecaySceneOptions,
} from '../three/decayScene.ts';
import CheckList from './CheckList.vue';
import NumberControl from './NumberControl.vue';
import SurvivalPlot from './SurvivalPlot.vue';

/**
 * A population of simulated objects decaying inside a bounded chamber.
 *
 * The scene is abstract on purpose — a box and identical spheres. It represents
 * "N₀ objects, each with one exponential lifetime", not an atom, because the
 * mathematics applies to queues and failures just as well as to nuclei.
 *
 * Rendering owns the animation frame; the engine owns time. The render loop
 * runs whether or not the simulation is playing (it drives the idle camera
 * orbit), and it never advances the model.
 */
const props = withDefaults(
  defineProps<{
    // `| undefined` throughout: the workspace runs with
    // `exactOptionalPropertyTypes`, and callers legitimately forward an
    // optional value rather than omitting the attribute.
    mode?: DisplayMode | undefined;
    seed?: number | undefined;
    initialCount?: number | undefined;
    rate?: number | undefined;
    autoplay?: boolean | undefined;
    speed?: number | undefined;
    /** Freeze at a deterministic simulation time, for captures and slides. */
    freezeAtTime?: number | undefined;
    title?: string | undefined;
    showChecks?: boolean | undefined;
    /** Render the 2D fallback even where WebGL 2 works. Used by tests and docs. */
    forceFallback?: boolean | undefined;
    /** Scene factory seam. Tests inject a stub renderer; production uses WebGL. */
    createScene?: ((options: DecaySceneOptions) => DecayScene) | undefined;
  }>(),
  {
    mode: 'embed',
    seed: 20260801,
    initialCount: 400,
    rate: 0.35,
    autoplay: false,
    speed: 1,
    showChecks: true,
    forceFallback: false,
  },
);

const seedSpec: SeedFieldSpec = {
  kind: 'seed',
  label: 'Seed',
  description: 'Fixes both the lifetimes and the placement of every object.',
  default: props.seed,
};

const params = ref<RadioactiveDecayParams>({
  initialCount: props.initialCount,
  rate: props.rate,
});
const seedValue = ref(props.seed);

const sim = useSimulation(radioactiveDecayCase, {
  seed: props.seed,
  params: params.value,
  speed: props.speed,
  ...(props.freezeAtTime !== undefined ? { freezeAtTime: props.freezeAtTime } : {}),
});

const snapshot = sim.snapshot;
const interactive = computed(() => props.mode !== 'social-h' && props.mode !== 'social-v');
/** Modes with a hard height budget: a 16:9 slide and a 9:16 capture. */
const dense = computed(() => props.mode === 'slide' || props.mode === 'social-v');

/* ---- Renderer lifecycle -------------------------------------------------- */

const shell = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
/** null until mount decides; true means "3D is running". */
const webglReady = ref<boolean | null>(null);

let scene: DecayScene | null = null;
let frameHandle: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let lastFrameTime = 0;

function renderFrame(timestamp: number): void {
  if (scene === null) return;
  const elapsed = lastFrameTime === 0 ? 0 : (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  // Purely visual: drives the camera orbit and the decay-flash timers.
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
  if (scene !== null) {
    scene.dispose();
    scene = null;
  }
  lastFrameTime = 0;
}

onMounted(() => {
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
    const factory = props.createScene ?? createDecayScene;
    scene = factory({
      canvas: canvasElement,
      width,
      height,
      pixelRatio: Math.min(globalThis.devicePixelRatio ?? 1, 2),
      // A frozen capture must not drift between two screenshots.
      spinRate: props.freezeAtTime !== undefined ? 0 : 0.12,
    });
  } catch {
    // A context that reports webgl2 but fails to initialise is still a
    // fallback case, not a crash.
    webglReady.value = false;
    return;
  }

  webglReady.value = true;
  scene.update(snapshot.value as RadioactiveDecaySnapshot);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined || scene === null) return;
      scene.resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(shellElement);
  }

  frameHandle = requestAnimationFrame(renderFrame);
  if (props.autoplay) sim.play();
});

onBeforeUnmount(teardown);

// Push each new snapshot into the scene. Vue's watcher, not a timer.
watch(snapshot, (next) => {
  scene?.update(next as RadioactiveDecaySnapshot);
});

/* ---- Parameters ---------------------------------------------------------- */

watch(
  params,
  (next) => {
    sim.reset({ seed: seedValue.value, params: next });
    scene?.update(snapshot.value as RadioactiveDecaySnapshot);
  },
  { deep: true },
);

watch(seedValue, (next) => {
  sim.reset({ seed: next, params: params.value });
  scene?.update(snapshot.value as RadioactiveDecaySnapshot);
});

const SPEEDS = [0.5, 1, 2, 4] as const;

function resetAll(): void {
  sim.reset({ seed: seedValue.value, params: params.value });
  scene?.update(snapshot.value as RadioactiveDecaySnapshot);
}

/* ---- 2D fallback projection ---------------------------------------------- */

const FALLBACK_SIZE = 260;

/** Orthographic x/y projection of the chamber, with a depth-sorted draw order. */
const fallbackParticles = computed(() =>
  [...snapshot.value.particles]
    .sort((a, b) => a.z - b.z)
    .map((p) => ({
      id: p.id,
      cx: ((p.x + 1) / 2) * FALLBACK_SIZE,
      cy: ((1 - p.y) / 2) * FALLBACK_SIZE,
      r: 2.2 + (p.z + 1) * 0.7,
      alive: p.alive,
    })),
);

const survivingPercent = computed(() =>
  snapshot.value.initialCount === 0
    ? 0
    : (100 * snapshot.value.active) / snapshot.value.initialCount,
);
</script>

<template>
  <section class="sc-frame" :class="`sc-frame--${mode}`" data-testid="decay-chamber-3d">
    <header class="sc-header">
      <div>
        <h3 class="sc-title">{{ title ?? 'Decay of a simulated population' }}</h3>
        <p class="sc-caption">
          Every object receives one Exponential(λ) lifetime at t = 0, drawn with the same inverse
          transform. The survivor count is then a pure function of time.
        </p>
      </div>
      <span class="sc-hint sc-numeric">
        t = {{ formatValue(snapshot.time, 2) }}s · {{ snapshot.active }} /
        {{ snapshot.initialCount }} remaining
      </span>
    </header>

    <div class="sc-split sc-split--plot-controls">
      <div class="sc-stack">
        <!-- Chamber and survival curve: stacked in a page, paired on a slide. -->
        <div class="sc-split sc-split--media-pair">
          <div ref="shell" class="sc-canvas-shell" data-testid="decay-chamber-shell">
            <canvas v-show="webglReady === true" ref="canvas" data-testid="decay-canvas" />

            <div
              v-if="webglReady === false"
              class="sc-fallback"
              data-testid="decay-fallback"
              role="img"
              aria-label="Two-dimensional projection of the decay chamber"
            >
              <svg
                class="sc-plot"
                :viewBox="`0 0 ${FALLBACK_SIZE} ${FALLBACK_SIZE}`"
                :style="{ maxWidth: `${FALLBACK_SIZE}px` }"
              >
                <rect
                  class="sc-plot__surface"
                  x="1"
                  y="1"
                  :width="FALLBACK_SIZE - 2"
                  :height="FALLBACK_SIZE - 2"
                />
                <circle
                  v-for="p in fallbackParticles"
                  :key="p.id"
                  :cx="p.cx"
                  :cy="p.cy"
                  :r="p.alive ? p.r : p.r * 0.5"
                  :fill="p.alive ? 'var(--sc-theoretical)' : 'var(--sc-uncertainty)'"
                  :opacity="p.alive ? 0.95 : 0.3"
                />
              </svg>
              <p class="sc-hint">
                WebGL 2 is unavailable, so the chamber is shown as a flat x–y projection. The
                simulation itself is unaffected — it never depended on the renderer.
              </p>
            </div>

            <div v-if="webglReady === true" class="sc-canvas-overlay">
              <span>t = {{ formatValue(snapshot.time, 2) }}s</span>
              <span>N = {{ snapshot.active }}</span>
              <span>{{ survivingPercent.toFixed(1) }}%</span>
            </div>
          </div>

          <SurvivalPlot
            :empirical="snapshot.survivalCurve"
            :theoretical="snapshot.theoreticalSurvival"
            :horizon="snapshot.horizon"
            :half-life="snapshot.halfLife"
            :current-time="snapshot.time"
            :current-fraction="
              snapshot.initialCount === 0 ? 0 : snapshot.active / snapshot.initialCount
            "
            :width="440"
            :height="dense ? 215 : 250"
          />
        </div>

        <div class="sc-legend">
          <span class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--simulated" />simulated survivors
          </span>
          <span class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--theoretical" />e<sup>−λt</sup>
          </span>
        </div>
      </div>

      <aside class="sc-stack">
        <div class="sc-metrics">
          <div class="sc-metric sc-metric--simulated">
            <span class="sc-metric__label">Survivors</span>
            <span class="sc-metric__value">{{ snapshot.active }}</span>
          </div>
          <div class="sc-metric">
            <span class="sc-metric__label">Decayed</span>
            <span class="sc-metric__value">{{ snapshot.decayed }}</span>
          </div>
          <div class="sc-metric sc-metric--theoretical">
            <span class="sc-metric__label">Half-life</span>
            <span class="sc-metric__value">{{ formatValue(snapshot.halfLife, 2) }}</span>
          </div>
          <div class="sc-metric sc-metric--theoretical">
            <span class="sc-metric__label">Mean life</span>
            <span class="sc-metric__value">{{ formatValue(snapshot.meanLifetime, 2) }}</span>
          </div>
        </div>

        <template v-if="interactive">
          <div class="sc-button-group sc-capture-hide">
            <button
              class="sc-button sc-button--primary"
              type="button"
              :disabled="sim.complete.value"
              @click="sim.toggle()"
            >
              {{ sim.playing.value ? 'Pause' : 'Play' }}
            </button>
            <button
              class="sc-button"
              type="button"
              :disabled="sim.complete.value"
              @click="sim.stepOnce()"
            >
              Step
            </button>
            <button class="sc-button" type="button" @click="resetAll()">Reset</button>
          </div>

          <div class="sc-control sc-control--stacked">
            <span class="sc-control__header">
              <span class="sc-control__label">Speed</span>
              <span class="sc-control__value">{{ sim.speed.value }}×</span>
            </span>
            <div class="sc-button-group sc-capture-hide">
              <button
                v-for="option in SPEEDS"
                :key="option"
                class="sc-button"
                type="button"
                :aria-pressed="sim.speed.value === option"
                :class="{ 'sc-button--primary': sim.speed.value === option }"
                @click="sim.speed.value = option"
              >
                {{ option }}×
              </button>
            </div>
            <span class="sc-hint">
              Speed scales simulation seconds per real second. It changes how fast you watch, never
              what happens.
            </span>
          </div>

          <NumberControl
            v-model="params.initialCount"
            :spec="radioactiveDecayCase.schema.initialCount"
          />
          <NumberControl v-model="params.rate" :spec="radioactiveDecayCase.schema.rate" />
          <NumberControl v-model="seedValue" :spec="seedSpec" />
        </template>

        <CheckList v-if="showChecks" :checks="snapshot.checks" />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.sc-canvas-shell {
  aspect-ratio: 4 / 3;
}
</style>
