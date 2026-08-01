<script setup lang="ts">
import {
  inverseTransformCase,
  type InverseTransformParams,
} from '@simulaciencia/case-inverse-transform';
import { MAX_SEED, type SeedFieldSpec } from '@simulaciencia/schemas';
import { type DisplayMode } from '@simulaciencia/theme';
import { computed, ref, watch } from 'vue';
import { useSimulation } from '../composables/useSimulation.ts';
import { formatValue } from '../plot/scale.ts';
import CdfPlot from './CdfPlot.vue';
import CheckList from './CheckList.vue';
import HistogramPlot from './HistogramPlot.vue';
import MappingStrip from './MappingStrip.vue';
import NumberControl from './NumberControl.vue';

/**
 * The inverse-transform laboratory.
 *
 * Holds no statistics of its own: every number on screen comes from the
 * snapshot the engine produced. Its only state is UI state — which controls are
 * open, which display mode is active.
 */
const props = withDefaults(
  defineProps<{
    // `| undefined` throughout: the workspace runs with
    // `exactOptionalPropertyTypes`, and callers legitimately forward an
    // optional value rather than omitting the attribute.
    mode?: DisplayMode | undefined;
    seed?: number | undefined;
    rate?: number | undefined;
    sampleCount?: number | undefined;
    /** Reveal everything on mount. Slides usually want this. */
    revealAll?: boolean | undefined;
    /** Freeze at a deterministic simulation time, for captures. */
    freezeAtTime?: number | undefined;
    title?: string | undefined;
    showCdf?: boolean | undefined;
    showChecks?: boolean | undefined;
  }>(),
  {
    mode: 'embed',
    seed: 20260801,
    rate: 1.5,
    sampleCount: 500,
    revealAll: false,
    showCdf: true,
    showChecks: true,
  },
);

const seedSpec: SeedFieldSpec = {
  kind: 'seed',
  label: 'Seed',
  description: `Any integer in [0, ${MAX_SEED}]. The same seed always redraws the same sample.`,
  default: props.seed,
};

const params = ref<InverseTransformParams>({ rate: props.rate, sampleCount: props.sampleCount });
const seedValue = ref(props.seed);

const sim = useSimulation(inverseTransformCase, {
  seed: props.seed,
  params: params.value,
  speed: 6,
  ...(props.freezeAtTime !== undefined ? { freezeAtTime: props.freezeAtTime } : {}),
});

if (props.revealAll) sim.finish();

// A parameter change invalidates every draw, so the run restarts from scratch.
// This is honest: you cannot "keep" samples drawn under a different λ.
watch(
  params,
  (next) => {
    sim.reset({ seed: seedValue.value, params: next });
    if (props.revealAll) sim.finish();
  },
  { deep: true },
);

watch(seedValue, (next) => {
  sim.reset({ seed: next, params: params.value });
  if (props.revealAll) sim.finish();
});

const interactive = computed(() => props.mode !== 'social-h' && props.mode !== 'social-v');
const compact = computed(() => props.mode === 'social-v');
/** Modes with a hard height budget: a 16:9 slide and a 9:16 capture. */
const dense = computed(() => props.mode === 'slide' || props.mode === 'social-v');
const plotWidth = computed(() => (compact.value ? 420 : 480));
const plotHeight = computed(() => (dense.value ? 205 : 260));

function newSeed(): void {
  // A visible, reproducible bump rather than a random one: the student can
  // read the seed off the screen and reproduce the picture exactly.
  seedValue.value = (seedValue.value + 1) % (MAX_SEED + 1);
}

const snapshot = sim.snapshot;

const progressLabel = computed(
  () => `${snapshot.value.revealed} / ${snapshot.value.sampleCount} drawn`,
);
</script>

<template>
  <section class="sc-frame" :class="`sc-frame--${mode}`" data-testid="inverse-transform-explorer">
    <header class="sc-header">
      <div>
        <h3 class="sc-title">{{ title ?? 'Inverse transform sampling' }}</h3>
        <p class="sc-caption">
          Draw <em>U</em> uniformly on (0, 1), then apply the inverse CDF <em>X</em> = −ln(1 −
          <em>U</em>) / λ. The result is Exponential(λ).
        </p>
      </div>
      <span class="sc-hint sc-numeric">{{ progressLabel }}</span>
    </header>

    <div class="sc-split sc-split--plot-controls">
      <div class="sc-stack">
        <MappingStrip
          :uniforms="snapshot.uniforms"
          :samples="snapshot.samples"
          :recent="snapshot.recent"
          :latest="snapshot.latest"
          :x-max="snapshot.xMax"
          :width="plotWidth"
          :height="dense ? 150 : 190"
        />

        <div class="sc-split" :class="{ 'sc-split--even': showCdf && !compact }">
          <HistogramPlot
            :histogram="snapshot.histogram"
            :density="snapshot.theoreticalDensity"
            title="Sample histogram vs theoretical density"
            x-label="x"
            :width="plotWidth"
            :height="plotHeight"
          />
          <CdfPlot
            v-if="showCdf"
            :empirical="snapshot.empiricalCdf"
            :theoretical="snapshot.theoreticalCdf"
            :x-max="snapshot.xMax"
            title="Empirical vs theoretical CDF"
            x-label="x"
            :width="plotWidth"
            :height="plotHeight"
          />
        </div>

        <div class="sc-legend">
          <span class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--simulated" />simulated sample
          </span>
          <span class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--theoretical" />theoretical model
          </span>
          <span class="sc-legend__item">
            <span class="sc-legend__swatch sc-legend__swatch--uncertainty" />draw in progress
          </span>
        </div>
      </div>

      <aside class="sc-stack">
        <table class="sc-stats">
          <caption class="sc-visually-hidden">
            Theoretical versus empirical statistics
          </caption>
          <thead>
            <tr>
              <th scope="col">Statistic</th>
              <th scope="col" class="sc-stats__theoretical">Theory</th>
              <th scope="col" class="sc-stats__simulated">Sample</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Mean</th>
              <td>{{ formatValue(snapshot.theoretical.mean) }}</td>
              <td>{{ formatValue(snapshot.empirical.mean) }}</td>
            </tr>
            <tr>
              <th scope="row">Variance</th>
              <td>{{ formatValue(snapshot.theoretical.variance) }}</td>
              <td>{{ formatValue(snapshot.empirical.variance) }}</td>
            </tr>
            <tr>
              <th scope="row">Std. error</th>
              <td>—</td>
              <td>{{ formatValue(snapshot.empirical.standardError, 4) }}</td>
            </tr>
            <tr>
              <th scope="row">n</th>
              <td>—</td>
              <td>{{ snapshot.empirical.count }}</td>
            </tr>
          </tbody>
        </table>

        <template v-if="interactive">
          <NumberControl v-model="params.rate" :spec="inverseTransformCase.schema.rate" />
          <NumberControl
            v-model="params.sampleCount"
            :spec="inverseTransformCase.schema.sampleCount"
          />
          <NumberControl v-model="seedValue" :spec="seedSpec" />

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
              Step one draw
            </button>
            <button
              class="sc-button"
              type="button"
              :disabled="sim.complete.value"
              @click="sim.finish()"
            >
              Draw all
            </button>
            <button class="sc-button" type="button" @click="sim.reset({ seed: seedValue })">
              Reset
            </button>
            <button class="sc-button" type="button" @click="newSeed()">Resample (seed + 1)</button>
          </div>
        </template>

        <CheckList v-if="showChecks" :checks="snapshot.checks" />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.sc-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
