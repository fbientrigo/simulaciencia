<script setup lang="ts">
import {
  POISSON_STEP_SECONDS,
  poissonCountingCase,
  type PoissonCountingParams,
} from '@simulaciencia/case-poisson-counting';
import type { SeedFieldSpec } from '@simulaciencia/schemas';
import type { DisplayMode } from '@simulaciencia/theme';
import { computed, onMounted, ref, watch } from 'vue';
import { useSimulation } from '../composables/useSimulation.ts';
import { formatValue } from '../plot/scale.ts';
import { STAGE_DESCRIPTIONS, stageFeatures, type TeachingStage } from '../teaching/stages.ts';
import type { DetectorScene, DetectorSceneOptions } from '../three/detectorScene.ts';
import CountTimeline from './CountTimeline.vue';
import DiscreteCountChart from './DiscreteCountChart.vue';
import NumberControl from './NumberControl.vue';
import PoissonDetector3D from './PoissonDetector3D.vue';
import PoissonDiagnostics from './PoissonDiagnostics.vue';

/**
 * The staged counting laboratory.
 *
 * Three concerns stay apart here, deliberately:
 *  - the statistics come from `poissonCountingCase`, which knows nothing about
 *    Vue, Three.js, stages or slides;
 *  - the snapshot is renderer-independent, so the 3D detector and the 2D
 *    fallback consume the identical numbers;
 *  - the STAGE is pedagogy only. It decides what is on screen and never what
 *    is computed. Every stage, given the same seed and parameters, holds the
 *    same simulation — `scene` and `diagnostics` differ only in what is drawn.
 *
 * Every learner-visible string in this file is Spanish.
 */
const props = withDefaults(
  defineProps<{
    // `| undefined` throughout: the workspace runs with
    // `exactOptionalPropertyTypes`, and callers legitimately forward an
    // optional value rather than omitting the attribute.
    stage?: TeachingStage | undefined;
    mode?: DisplayMode | undefined;
    seed?: number | undefined;
    rate?: number | undefined;
    windowDuration?: number | undefined;
    maxWindows?: number | undefined;
    /**
     * Observation windows already revealed when the lab appears.
     *
     * Reconstructed exactly from the seed and the parameters: because one case
     * step reveals exactly one window, "N windows" and "N × fixedDt of
     * simulation time" are the same statement, and the runner reaches it by
     * replaying the same precomputed windows every time.
     */
    initialWindows?: number | undefined;
    autoplay?: boolean | undefined;
    speed?: number | undefined;
    /** Render the 2D fallback even where WebGL 2 works. Used by tests and docs. */
    forceFallback?: boolean | undefined;
    title?: string | undefined;
    /** Expose λ, Δt, the window budget and the seed as editable controls. */
    showParameters?: boolean | undefined;
    /** Scene factory seam. Tests inject a stub renderer; production uses WebGL. */
    createScene?: ((options: DetectorSceneOptions) => DetectorScene) | undefined;
  }>(),
  {
    stage: 'diagnostics',
    mode: 'embed',
    seed: 20260801,
    rate: 3,
    windowDuration: 1,
    maxWindows: 600,
    initialWindows: 0,
    autoplay: false,
    speed: 1,
    forceFallback: false,
    showParameters: false,
  },
);

interface PoissonCountingLabState {
  readonly seed: number;
  readonly params: PoissonCountingParams;
  readonly revealedWindows: number;
}

const emit = defineEmits<{
  'state-change': [state: PoissonCountingLabState];
}>();

const features = computed(() => stageFeatures(props.stage));

const seedSpec: SeedFieldSpec = {
  kind: 'seed',
  label: 'Semilla',
  description: 'Fija los tiempos entre llegadas y las posiciones de cada evento.',
  default: props.seed,
};

const params = ref<PoissonCountingParams>({
  rate: props.rate,
  windowDuration: props.windowDuration,
  maxWindows: props.maxWindows,
});
const seedValue = ref(props.seed);

/** Simulation time that corresponds to the requested number of revealed windows. */
const initialTime = computed(() => props.initialWindows * POISSON_STEP_SECONDS);

const sim = useSimulation(poissonCountingCase, {
  seed: props.seed,
  params: params.value,
  speed: props.speed,
  ...(props.initialWindows > 0 ? { freezeAtTime: initialTime.value } : {}),
});

const snapshot = sim.snapshot;

const interactive = computed(() => props.mode !== 'social-h' && props.mode !== 'social-v');
/** Modes with a hard height budget: a 16:9 slide and a 9:16 capture. */
const dense = computed(() => props.mode === 'slide' || props.mode === 'social-v');

// Autoplay only means anything once the stage actually offers playback, and
// only after mount, so the frame loop never starts before there is a DOM.
onMounted(() => {
  if (props.autoplay && features.value.automaticPlayback) sim.play();
});

/* ---- Sampling ------------------------------------------------------------ */

/**
 * Reveal exactly one more observation window.
 *
 * The manual button and the transport's step control are the same action, and
 * say so in the caption: one click, one window, one integer. Keeping both is
 * what lets the `automatic` stage keep manual sampling alive alongside
 * autoplay, which the lesson relies on when a student asks "do that one again".
 */
function sampleOneWindow(): void {
  sim.stepOnce();
}

function restart(): void {
  sim.reset({ seed: seedValue.value, params: params.value });
  if (props.initialWindows > 0) sim.seekTo(initialTime.value);
}

watch(params, () => restart(), { deep: true });
watch(seedValue, () => restart());

function emitState(): void {
  emit('state-change', {
    seed: seedValue.value,
    params: { ...params.value },
    revealedWindows: snapshot.value.revealedWindows,
  });
}

watch([params, seedValue, () => snapshot.value.revealedWindows], emitState, {
  deep: true,
  immediate: true,
});

const SPEEDS = [0.5, 1, 2, 4] as const;

/* ---- Derived read-outs --------------------------------------------------- */

const detectorHeight = computed(() => (dense.value ? 200 : 240));
const chartHeight = computed(() => (dense.value ? 220 : 262));

/** A dense mode has no room for a long tail; the timeline carries the shape. */
const historyTail = computed(() =>
  snapshot.value.countHistory.slice(dense.value ? -8 : -12).join(' · '),
);

const canSample = computed(() => !sim.complete.value);
</script>

<template>
  <section
    class="sc-frame"
    :class="`sc-frame--${mode}`"
    data-testid="poisson-counting-lab"
    :data-stage="stage"
  >
    <header class="sc-header">
      <div>
        <h3 class="sc-title">{{ title ?? poissonCountingCase.title }}</h3>
        <p class="sc-caption">{{ STAGE_DESCRIPTIONS[stage] }}</p>
      </div>
      <span class="sc-hint sc-numeric">
        λ = {{ formatValue(snapshot.rate, 2) }} · Δt = {{ formatValue(snapshot.windowDuration, 2) }}
        <template v-if="features.count">
          · exposición total = {{ formatValue(snapshot.totalExposure, 2) }}
        </template>
      </span>
    </header>

    <div class="sc-split sc-split--plot-controls">
      <div class="sc-stack">
        <div class="sc-split sc-split--media-pair">
          <PoissonDetector3D
            :snapshot="snapshot"
            :show-count="features.count"
            :force-fallback="forceFallback"
            :create-scene="createScene"
            :style="{ '--sc-detector-height': `${detectorHeight}px` }"
          />

          <div v-if="features.histogram || features.countHistory" class="sc-stack">
            <DiscreteCountChart
              v-if="features.histogram"
              :bins="snapshot.histogram"
              :show-theory="features.theory"
              :expected-count="snapshot.expectedCount"
              :observations="snapshot.revealedWindows"
              :height="chartHeight"
            />
            <CountTimeline
              v-if="features.countHistory"
              :counts="snapshot.countHistory"
              :expected-count="snapshot.expectedCount"
              :height="features.histogram ? 108 : 150"
              :visible="features.histogram ? 30 : 40"
            />
          </div>
        </div>

        <div v-if="features.histogram" class="sc-legend">
          <span class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--simulated" />frecuencia observada
          </span>
          <span v-if="features.theory" class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--theoretical" />P(K = k) de Poisson
          </span>
        </div>

        <p v-if="!features.count" class="sc-hint" data-testid="poisson-question">
          ¿Cuántos eventos observaremos durante una ventana de tiempo?
        </p>
      </div>

      <aside class="sc-stack">
        <!-- Diagnostics lead the column rather than trail it. On a 16:9 slide
             the control column is the first thing to run out of height, and
             the panel this stage exists for must not be the part that
             scrolls out of sight. -->
        <PoissonDiagnostics v-if="features.diagnostics" :snapshot="snapshot" />

        <div v-if="features.count" class="sc-metrics">
          <div class="sc-metric sc-metric--simulated">
            <span class="sc-metric__label">Conteo actual K</span>
            <span class="sc-metric__value" data-testid="poisson-current-count">
              {{ snapshot.currentCount }}
            </span>
          </div>
          <div class="sc-metric">
            <span class="sc-metric__label">Ventanas observadas</span>
            <span class="sc-metric__value" data-testid="poisson-revealed-windows">
              {{ snapshot.revealedWindows }}
            </span>
          </div>
          <!-- The label is uppercased by the theme, which would turn "μ = λΔt"
               into "M = ΛΔT". Greek belongs in the value, which is not. -->
          <div v-if="features.theory" class="sc-metric sc-metric--theoretical">
            <span class="sc-metric__label">Valor esperado</span>
            <span class="sc-metric__value" data-testid="poisson-expected-count">
              μ = {{ formatValue(snapshot.expectedCount, 2) }}
            </span>
          </div>
        </div>

        <div v-if="features.countHistory" class="sc-control sc-control--stacked">
          <span class="sc-control__header">
            <span class="sc-control__label">Últimos conteos</span>
          </span>
          <p class="sc-numeric" data-testid="poisson-history-tail">
            {{ historyTail === '' ? 'todavía ninguno' : historyTail }}
          </p>
        </div>

        <template v-if="interactive">
          <div v-if="features.manualSampling" class="sc-button-group sc-capture-hide">
            <button
              class="sc-button sc-button--primary"
              type="button"
              :disabled="!canSample"
              data-testid="poisson-sample-window"
              @click="sampleOneWindow()"
            >
              Simular una ventana
            </button>
          </div>

          <div v-if="features.automaticPlayback" class="sc-button-group sc-capture-hide">
            <button
              class="sc-button sc-button--primary"
              type="button"
              :disabled="sim.complete.value"
              data-testid="poisson-toggle"
              @click="sim.toggle()"
            >
              {{ sim.playing.value ? 'Pausar' : 'Reproducir' }}
            </button>
            <button
              class="sc-button"
              type="button"
              :disabled="!canSample"
              data-testid="poisson-step"
              @click="sampleOneWindow()"
            >
              Avanzar
            </button>
            <button class="sc-button" type="button" data-testid="poisson-reset" @click="restart()">
              Reiniciar
            </button>
          </div>

          <div v-if="features.speedControls" class="sc-control sc-control--stacked">
            <span class="sc-control__header">
              <span class="sc-control__label">Velocidad</span>
              <span class="sc-control__value">{{ sim.speed.value }}×</span>
            </span>
            <div class="sc-button-group sc-capture-hide">
              <button
                v-for="option in SPEEDS"
                :key="option"
                class="sc-button"
                type="button"
                :aria-pressed="sim.speed.value === option"
                :aria-label="`Velocidad ${option} veces`"
                :class="{ 'sc-button--primary': sim.speed.value === option }"
                @click="sim.speed.value = option"
              >
                {{ option }}×
              </button>
            </div>
            <span class="sc-hint">
              La velocidad cambia el ritmo con que aparecen las ventanas, nunca lo que ocurre dentro
              de ellas. «Simular una ventana» sigue disponible en todo momento.
            </span>
          </div>

          <template v-if="showParameters">
            <NumberControl v-model="params.rate" :spec="poissonCountingCase.schema.rate" />
            <NumberControl
              v-model="params.windowDuration"
              :spec="poissonCountingCase.schema.windowDuration"
            />
            <NumberControl
              v-model="params.maxWindows"
              :spec="poissonCountingCase.schema.maxWindows"
            />
            <NumberControl v-model="seedValue" :spec="seedSpec" />
          </template>
        </template>
      </aside>
    </div>
  </section>
</template>

<style scoped>
/* The detector keeps a stable height inside a slide's fixed budget; the shell
 * itself owns the aspect ratio when no budget is imposed. */
.sc-canvas-shell:not(.sc-canvas-shell--flat) {
  max-height: var(--sc-detector-height, 260px);
}
</style>
