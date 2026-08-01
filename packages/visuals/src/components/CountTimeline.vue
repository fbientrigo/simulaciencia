<script setup lang="ts">
import { computed } from 'vue';

/**
 * The short history of observed counts: one dot per completed window.
 *
 * Its job on the `counter` and `automatic` stages is to make "every repetition
 * gives a different integer" visible before any histogram exists. It shows a
 * window onto the most recent observations rather than all of them, because at
 * 400 windows a full timeline is a grey smear and teaches nothing.
 *
 * All labels are Spanish: this is only ever shown to a class.
 */
const props = withDefaults(
  defineProps<{
    counts: readonly number[];
    /** μ = λΔt, drawn as the horizontal reference the dots scatter around. */
    expectedCount: number;
    /** How many of the most recent observations to draw. */
    visible?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    title?: string | undefined;
  }>(),
  { visible: 40, width: 470, height: 130, title: 'Historial de conteos' },
);

const margin = { top: 22, right: 12, bottom: 26, left: 34 };

const inner = computed(() => ({
  left: margin.left,
  top: margin.top,
  width: Math.max(1, props.width - margin.left - margin.right),
  height: Math.max(1, props.height - margin.top - margin.bottom),
}));

const shown = computed(() => props.counts.slice(-props.visible));

/** Index of the first drawn observation in the full history, for the caption. */
const firstShownIndex = computed(() => Math.max(0, props.counts.length - shown.value.length));

const yMax = computed(() => {
  const peak = shown.value.reduce((max, k) => Math.max(max, k), 0);
  return Math.max(4, Math.ceil(Math.max(peak, props.expectedCount) * 1.15));
});

function yPixel(value: number): number {
  return inner.value.top + inner.value.height * (1 - value / yMax.value);
}

function xPixel(index: number): number {
  const slots = Math.max(1, props.visible);
  return inner.value.left + ((index + 0.5) * inner.value.width) / slots;
}

const points = computed(() =>
  shown.value.map((k, index) => ({
    key: firstShownIndex.value + index,
    cx: xPixel(index),
    cy: yPixel(k),
    latest: index === shown.value.length - 1,
    count: k,
  })),
);

const linkPath = computed(() =>
  points.value.length < 2
    ? ''
    : points.value
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(2)} ${p.cy.toFixed(2)}`)
        .join(''),
);

const accessibleLabel = computed(
  () =>
    `${props.title}: ${props.counts.length} ventanas observadas, ` +
    `las últimas ${shown.value.length} en pantalla, alrededor de μ = ${props.expectedCount.toFixed(2)}.`,
);
</script>

<template>
  <svg
    class="sc-plot"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="accessibleLabel"
    data-testid="count-timeline"
  >
    <title>{{ title }}</title>

    <rect
      class="sc-plot__surface"
      :x="inner.left"
      :y="inner.top"
      :width="inner.width"
      :height="inner.height"
    />

    <line
      class="sc-mark-rule"
      :x1="inner.left"
      :x2="inner.left + inner.width"
      :y1="yPixel(expectedCount)"
      :y2="yPixel(expectedCount)"
    />

    <path v-if="linkPath" class="sc-mark-link" :d="linkPath" />
    <circle
      v-for="point in points"
      :key="point.key"
      class="sc-mark-point"
      :class="{ 'sc-mark-point--latest': point.latest }"
      :cx="point.cx"
      :cy="point.cy"
      :r="point.latest ? 4.5 : 2.6"
    />

    <g aria-hidden="true">
      <text class="sc-plot__tick" :x="inner.left - 6" :y="yPixel(0) + 3.5" text-anchor="end">
        0
      </text>
      <text class="sc-plot__tick" :x="inner.left - 6" :y="yPixel(yMax) + 3.5" text-anchor="end">
        {{ yMax }}
      </text>
      <text class="sc-plot__title" :x="inner.left" :y="14">{{ title }}</text>
      <text class="sc-plot__tick" :x="inner.left + inner.width" :y="height - 8" text-anchor="end">
        ventanas {{ firstShownIndex + 1 }}–{{ counts.length }}
      </text>
      <text
        class="sc-plot__tick"
        :x="inner.left + inner.width"
        :y="yPixel(expectedCount) - 4"
        text-anchor="end"
      >
        μ = {{ expectedCount.toFixed(2) }}
      </text>
    </g>
  </svg>
</template>
