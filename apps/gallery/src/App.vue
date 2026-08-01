<script setup lang="ts">
import { INVERSE_TRANSFORM_ID, inverseTransformCase } from '@simulaciencia/case-inverse-transform';
import { RADIOACTIVE_DECAY_ID, radioactiveDecayCase } from '@simulaciencia/case-radioactive-decay';
import { decodeConfigFromQuery, encodeConfigToQuery, validateParams } from '@simulaciencia/schemas';
import {
  BRAND,
  DISPLAY_MODES,
  DISPLAY_MODE_LABELS,
  TOKEN_ROLES,
  type DisplayMode,
} from '@simulaciencia/theme';
import { BrandMark, DecayChamber3D, InverseTransformExplorer } from '@simulaciencia/visuals';
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

const inverseFreeze = pinned === INVERSE_TRANSFORM_ID ? (decoded.time ?? undefined) : undefined;
const decayFreeze = pinned === RADIOACTIVE_DECAY_ID ? (decoded.time ?? undefined) : undefined;

/** Build the shareable, deterministic link for a case as currently configured. */
function permalink(caseId: string): string {
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
