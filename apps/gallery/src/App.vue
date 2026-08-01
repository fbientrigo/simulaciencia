<script setup lang="ts">
import { INVERSE_TRANSFORM_ID, inverseTransformCase } from '@simulaciencia/case-inverse-transform';
import {
  POISSON_COUNTING_ID,
  POISSON_STEP_SECONDS,
  poissonCountingCase,
  type PoissonCountingParams,
} from '@simulaciencia/case-poisson-counting';
import { RADIOACTIVE_DECAY_ID, radioactiveDecayCase } from '@simulaciencia/case-radioactive-decay';
import { planSteps } from '@simulaciencia/core';
import { decodeConfigFromQuery, encodeConfigToQuery, validateParams } from '@simulaciencia/schemas';
import {
  BRAND,
  DISPLAY_MODES,
  DISPLAY_MODE_LABELS,
  TOKEN_ROLES,
  type DisplayMode,
} from '@simulaciencia/theme';
import {
  BrandMark,
  DecayChamber3D,
  InverseTransformExplorer,
  PoissonCountingLab,
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
  TEACHING_STAGES,
  type TeachingStage,
} from '@simulaciencia/visuals';
import { computed, ref } from 'vue';

/**
 * The gallery is a thin shell. It decides three things and nothing else:
 * which display mode to render in, which theme, and how to translate the URL
 * into a case configuration. All science lives behind the components.
 */

const decoded = decodeConfigFromQuery(new URLSearchParams(globalThis.location.search));

const mode = ref<DisplayMode>(
  (DISPLAY_MODES as readonly string[]).includes(decoded.rawParams.mode ?? '')
    ? (decoded.rawParams.mode as DisplayMode)
    : 'embed',
);
const dark = ref(decoded.rawParams.theme === 'dark');

/**
 * A URL may pin exactly one case. That case is restored from the query;
 * the other keeps its defaults, so the page always shows both.
 */
const pinned = decoded.caseId;

const inverseParams = computed(() => {
  const fallback = { rate: 1.5, sampleCount: 500 };
  if (pinned !== INVERSE_TRANSFORM_ID) return fallback;
  const parsed = validateParams(inverseTransformCase.schema, decoded.rawParams);
  return parsed.ok ? parsed.value : fallback;
});

const decayParams = computed(() => {
  const fallback = { initialCount: 400, rate: 0.35 };
  if (pinned !== RADIOACTIVE_DECAY_ID) return fallback;
  const parsed = validateParams(radioactiveDecayCase.schema, decoded.rawParams);
  return parsed.ok ? parsed.value : fallback;
});

const inverseSeed =
  pinned === INVERSE_TRANSFORM_ID && decoded.seed !== null ? decoded.seed : 20260801;
const decaySeed =
  pinned === RADIOACTIVE_DECAY_ID && decoded.seed !== null ? decoded.seed : 20260801;

const poissonParams = computed(() => {
  const fallback = { rate: 3, windowDuration: 1, maxWindows: 600 };
  if (pinned !== POISSON_COUNTING_ID) return fallback;
  const parsed = validateParams(poissonCountingCase.schema, decoded.rawParams);
  return parsed.ok ? parsed.value : fallback;
});

const poissonSeed =
  pinned === POISSON_COUNTING_ID && decoded.seed !== null ? decoded.seed : 20260801;

/**
 * The teaching stage is a PRESENTATION choice, so it travels in the URL beside
 * `mode` and `theme` rather than inside the case parameters — a frozen link has
 * to reproduce what was on screen, and the stage is part of that.
 */
const stage = ref<TeachingStage>(
  (TEACHING_STAGES as readonly string[]).includes(decoded.rawParams.stage ?? '')
    ? (decoded.rawParams.stage as TeachingStage)
    : 'diagnostics',
);

/**
 * A frozen `t` for the counting case is read back as a window count, because
 * exactly one case step reveals exactly one observation window. Partial steps
 * stay unrevealed, matching SimulationRunner.advanceToTime().
 */
const poissonWindows = computed(() =>
  pinned === POISSON_COUNTING_ID && decoded.time !== null
    ? planSteps(decoded.time, POISSON_STEP_SECONDS).steps
    : 400,
);

interface PoissonPermalinkState {
  readonly seed: number;
  readonly params: PoissonCountingParams;
  readonly revealedWindows: number;
}

const poissonState = ref<PoissonPermalinkState>({
  seed: poissonSeed,
  params: { ...poissonParams.value },
  revealedWindows: poissonWindows.value,
});

function updatePoissonState(state: PoissonPermalinkState): void {
  poissonState.value = state;
}

/** Force the 2D fallback, so the flat path can be reviewed on a real machine. */
const poissonFallback = ref(decoded.rawParams.fallback === '1');

const inverseFreeze = pinned === INVERSE_TRANSFORM_ID ? (decoded.time ?? undefined) : undefined;
const decayFreeze = pinned === RADIOACTIVE_DECAY_ID ? (decoded.time ?? undefined) : undefined;

/** Build the shareable, deterministic link for a case as currently configured. */
function permalink(caseId: string): string {
  if (caseId === POISSON_COUNTING_ID) {
    const query = encodeConfigToQuery({
      caseId: POISSON_COUNTING_ID,
      version: poissonCountingCase.version,
      seed: poissonState.value.seed,
      params: poissonState.value.params,
      time: poissonState.value.revealedWindows * POISSON_STEP_SECONDS,
    });
    query.set('mode', mode.value);
    query.set('stage', stage.value);
    if (poissonFallback.value) query.set('fallback', '1');
    if (dark.value) query.set('theme', 'dark');
    return `${globalThis.location.origin}${globalThis.location.pathname}?${query.toString()}`;
  }
  const query =
    caseId === INVERSE_TRANSFORM_ID
      ? encodeConfigToQuery({
          caseId: INVERSE_TRANSFORM_ID,
          version: inverseTransformCase.version,
          seed: inverseSeed,
          params: inverseParams.value,
          time: 20,
        })
      : encodeConfigToQuery({
          caseId: RADIOACTIVE_DECAY_ID,
          version: radioactiveDecayCase.version,
          seed: decaySeed,
          params: decayParams.value,
          time: 4,
        });
  query.set('mode', mode.value);
  if (dark.value) query.set('theme', 'dark');
  return `${globalThis.location.origin}${globalThis.location.pathname}?${query.toString()}`;
}

const copied = ref<string | null>(null);

async function copyPermalink(caseId: string): Promise<void> {
  const link = permalink(caseId);
  try {
    await navigator.clipboard.writeText(link);
    copied.value = caseId;
    globalThis.setTimeout(() => {
      copied.value = null;
    }, 1600);
  } catch {
    // Clipboard access is frequently blocked; the link is shown as text anyway.
    copied.value = null;
  }
}
</script>

<template>
  <div class="sc-root gallery" :data-sc-theme="dark ? 'dark' : 'light'">
    <header class="gallery__bar">
      <BrandMark :size="40" with-wordmark />
      <div class="gallery__toolbar">
        <label class="gallery__field">
          <span>Display mode</span>
          <select v-model="mode" class="sc-button">
            <option v-for="option in DISPLAY_MODES" :key="option" :value="option">
              {{ DISPLAY_MODE_LABELS[option] }}
            </option>
          </select>
        </label>
        <button class="sc-button" type="button" @click="dark = !dark">
          {{ dark ? 'Light surface' : 'Dark surface' }}
        </button>
      </div>
    </header>

    <p class="sc-caption">
      {{ BRAND.description }} Every visualization below is a pure function of a seed and a parameter
      set — copy a permalink and you get exactly this picture back.
    </p>

    <section class="sc-stack">
      <h2 class="sc-subtitle">1 · {{ inverseTransformCase.title }}</h2>
      <InverseTransformExplorer
        :key="`it-${mode}`"
        :mode="mode"
        :seed="inverseSeed"
        :rate="inverseParams.rate"
        :sample-count="inverseParams.sampleCount"
        :reveal-all="inverseFreeze === undefined"
        :freeze-at-time="inverseFreeze"
      />
      <div class="gallery__permalink">
        <button class="sc-button" type="button" @click="copyPermalink(INVERSE_TRANSFORM_ID)">
          {{ copied === INVERSE_TRANSFORM_ID ? 'Copied' : 'Copy permalink' }}
        </button>
        <code>{{ permalink(INVERSE_TRANSFORM_ID) }}</code>
      </div>
    </section>

    <section class="sc-stack">
      <h2 class="sc-subtitle">2 · {{ radioactiveDecayCase.title }}</h2>
      <DecayChamber3D
        :key="`rd-${mode}`"
        :mode="mode"
        :seed="decaySeed"
        :initial-count="decayParams.initialCount"
        :rate="decayParams.rate"
        :freeze-at-time="decayFreeze"
      />
      <div class="gallery__permalink">
        <button class="sc-button" type="button" @click="copyPermalink(RADIOACTIVE_DECAY_ID)">
          {{ copied === RADIOACTIVE_DECAY_ID ? 'Copied' : 'Copy permalink' }}
        </button>
        <code>{{ permalink(RADIOACTIVE_DECAY_ID) }}</code>
      </div>
    </section>

    <section class="sc-stack">
      <h2 class="sc-subtitle">3 · {{ poissonCountingCase.title }}</h2>
      <p class="sc-caption">
        Esta sección está en español porque forma parte de la Clase 01. La etapa didáctica decide
        qué se muestra, nunca qué se calcula: con la misma semilla y los mismos parámetros, todas
        las etapas contienen exactamente la misma simulación.
      </p>

      <div class="gallery__toolbar">
        <label class="gallery__field">
          <span>Etapa didáctica</span>
          <select v-model="stage" class="sc-button">
            <option v-for="option in TEACHING_STAGES" :key="option" :value="option">
              {{ STAGE_LABELS[option] }}
            </option>
          </select>
        </label>
        <label class="gallery__field">
          <span>Representación plana</span>
          <button class="sc-button" type="button" @click="poissonFallback = !poissonFallback">
            {{ poissonFallback ? 'Volver a 3D' : 'Forzar respaldo 2D' }}
          </button>
        </label>
      </div>
      <p class="sc-caption">{{ STAGE_DESCRIPTIONS[stage] }}</p>

      <PoissonCountingLab
        :key="`pc-${mode}-${stage}-${poissonFallback}`"
        :mode="mode"
        :stage="stage"
        :seed="poissonState.seed"
        :rate="poissonState.params.rate"
        :window-duration="poissonState.params.windowDuration"
        :max-windows="poissonState.params.maxWindows"
        :initial-windows="poissonState.revealedWindows"
        :force-fallback="poissonFallback"
        show-parameters
        @state-change="updatePoissonState"
      />
      <div class="gallery__permalink">
        <button class="sc-button" type="button" @click="copyPermalink(POISSON_COUNTING_ID)">
          {{ copied === POISSON_COUNTING_ID ? 'Enlace copiado' : 'Copiar enlace determinista' }}
        </button>
        <code>{{ permalink(POISSON_COUNTING_ID) }}</code>
      </div>
    </section>

    <section class="sc-stack">
      <h2 class="sc-subtitle">Design tokens</h2>
      <p class="sc-caption">
        Each colour names a role in the pedagogy, not a hue. Components ask for the role.
      </p>
      <table class="gallery__tokens">
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Role</th>
            <th scope="col">Usage</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="token in TOKEN_ROLES" :key="token.token">
            <td class="gallery__token-name">
              <span class="gallery__swatch" :style="{ background: `var(${token.token})` }" />
              {{ token.token }}
            </td>
            <td>{{ token.role }}</td>
            <td>{{ token.usage }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer class="sc-caption">{{ BRAND.name }} — {{ BRAND.tagline }}</footer>
  </div>
</template>
