<script setup lang="ts">
import type { CountBin } from '@simulaciencia/case-poisson-counting';
import { computed } from 'vue';

/**
 * A DISCRETE chart, written separately from `HistogramPlot` on purpose.
 *
 * `HistogramPlot` normalises counts to a density over continuous bins, which is
 * the honest way to compare a sample against a probability *density*. K is an
 * integer: there is no bin width, and dividing by one would produce a y-axis
 * that silently rescales the very numbers the lesson asks students to compare.
 * So each bar here stands for exactly one value of K and the y-axis is a plain
 * relative frequency, directly comparable with P(K = k).
 *
 * All labels are Spanish: this chart is only ever shown to a class.
 */
const props = withDefaults(
  defineProps<{
    bins: readonly CountBin[];
    /** Overlay the theoretical Poisson PMF. Off until the `theory` stage. */
    showTheory?: boolean | undefined;
    /** μ = λΔt, drawn as a vertical reference when theory is visible. */
    expectedCount?: number | undefined;
    /** How many windows produced these frequencies. Shown in the caption. */
    observations?: number | undefined;
    title?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }>(),
  {
    showTheory: false,
    observations: 0,
    width: 470,
    height: 270,
    title: 'Frecuencia observada de K',
  },
);

const margin = { top: 24, right: 14, bottom: 42, left: 52 };

const inner = computed(() => ({
  left: margin.left,
  top: margin.top,
  width: Math.max(1, props.width - margin.left - margin.right),
  height: Math.max(1, props.height - margin.top - margin.bottom),
}));

const yMax = computed(() => {
  let peak = 0;
  for (const bin of props.bins) {
    peak = Math.max(peak, bin.frequency);
    if (props.showTheory) peak = Math.max(peak, bin.probability);
  }
  // A floor keeps an empty chart from collapsing into a single line, and the
  // headroom stops the tallest bar touching the frame.
  return peak > 0 ? peak * 1.18 : 0.4;
});

/** Horizontal slot per bar, including the gap between neighbours. */
const slot = computed(() => inner.value.width / Math.max(1, props.bins.length));

function barX(index: number): number {
  return inner.value.left + index * slot.value + slot.value * 0.14;
}

const barWidth = computed(() => Math.max(1, slot.value * 0.72));

function centerX(index: number): number {
  return inner.value.left + (index + 0.5) * slot.value;
}

function yPixel(value: number): number {
  const { top, height } = inner.value;
  return top + height * (1 - value / yMax.value);
}

const baseline = computed(() => inner.value.top + inner.value.height);

const bars = computed(() =>
  props.bins.map((bin, index) => {
    const y = yPixel(bin.frequency);
    return {
      key: bin.label,
      label: bin.label,
      overflow: bin.overflow,
      x: barX(index),
      y,
      width: barWidth.value,
      height: Math.max(0, baseline.value - y),
      center: centerX(index),
      count: bin.count,
      frequency: bin.frequency,
      probability: bin.probability,
    };
  }),
);

/** Only label every nth tick once the support gets long, so they stay legible. */
const tickStride = computed(() => (props.bins.length > 22 ? 4 : props.bins.length > 13 ? 2 : 1));

const theoryPath = computed(() => {
  if (!props.showTheory) return '';
  const points = props.bins
    .map((bin, index) => ({ bin, index }))
    .filter(({ bin }) => !bin.overflow);
  if (points.length < 2) return '';
  return points
    .map(
      ({ bin, index }, i) =>
        `${i === 0 ? 'M' : 'L'}${centerX(index).toFixed(2)} ${yPixel(bin.probability).toFixed(2)}`,
    )
    .join('');
});

const theoryMarkers = computed(() =>
  props.showTheory
    ? props.bins.map((bin, index) => ({
        key: bin.label,
        cx: centerX(index),
        cy: yPixel(bin.probability),
        overflow: bin.overflow,
      }))
    : [],
);

/** Vertical rule at μ, positioned between bars when μ is not an integer. */
const expectedRuleX = computed(() => {
  const mu = props.expectedCount;
  if (!props.showTheory || mu === undefined || !Number.isFinite(mu)) return null;
  const ordinary = props.bins.filter((b) => !b.overflow).length;
  if (mu < 0 || mu > ordinary - 1) return null;
  return inner.value.left + (mu + 0.5) * slot.value;
});

const yTicks = computed(() => {
  const step = yMax.value / 4;
  return [0, step, step * 2, step * 3, step * 4];
});

const accessibleLabel = computed(
  () =>
    `${props.title}. ${props.observations} ventanas observadas.` +
    (props.showTheory ? ' Incluye la probabilidad teórica de Poisson.' : ''),
);
</script>

<template>
  <svg
    class="sc-plot"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="accessibleLabel"
    data-testid="discrete-count-chart"
  >
    <title>{{ title }}</title>

    <rect
      class="sc-plot__surface"
      :x="inner.left"
      :y="inner.top"
      :width="inner.width"
      :height="inner.height"
    />

    <g aria-hidden="true">
      <line
        v-for="t in yTicks"
        :key="`gy-${t}`"
        class="sc-plot__grid"
        :x1="inner.left"
        :x2="inner.left + inner.width"
        :y1="yPixel(t)"
        :y2="yPixel(t)"
      />
    </g>

    <g>
      <rect
        v-for="bar in bars"
        :key="bar.key"
        class="sc-mark-bar"
        :class="{ 'sc-mark-bar--overflow': bar.overflow }"
        :x="bar.x"
        :y="bar.y"
        :width="bar.width"
        :height="bar.height"
      />
    </g>

    <line
      v-if="expectedRuleX !== null"
      class="sc-mark-rule"
      :x1="expectedRuleX"
      :x2="expectedRuleX"
      :y1="inner.top"
      :y2="baseline"
      data-testid="expected-count-rule"
    />

    <path v-if="theoryPath" class="sc-mark-curve" :d="theoryPath" data-testid="poisson-pmf-curve" />
    <circle
      v-for="marker in theoryMarkers"
      :key="`pmf-${marker.key}`"
      class="sc-mark-point"
      :class="{ 'sc-mark-point--overflow': marker.overflow }"
      :cx="marker.cx"
      :cy="marker.cy"
      r="3.2"
    />

    <g aria-hidden="true">
      <line
        class="sc-plot__axis"
        :x1="inner.left"
        :x2="inner.left + inner.width"
        :y1="baseline"
        :y2="baseline"
      />
      <line
        class="sc-plot__axis"
        :x1="inner.left"
        :x2="inner.left"
        :y1="inner.top"
        :y2="baseline"
      />

      <text
        v-for="(bar, index) in bars"
        :key="`tx-${bar.key}`"
        class="sc-plot__tick"
        :x="bar.center"
        :y="baseline + 15"
        text-anchor="middle"
      >
        {{ bar.overflow || index % tickStride === 0 ? bar.label : '' }}
      </text>

      <text
        v-for="t in yTicks"
        :key="`ty-${t}`"
        class="sc-plot__tick"
        :x="inner.left - 7"
        :y="yPixel(t) + 3.5"
        text-anchor="end"
      >
        {{ t.toFixed(2) }}
      </text>

      <text
        class="sc-plot__axis-label"
        :x="inner.left + inner.width / 2"
        :y="height - 6"
        text-anchor="middle"
      >
        conteo K por ventana
      </text>
      <text
        class="sc-plot__axis-label"
        :transform="`translate(12, ${inner.top + inner.height / 2}) rotate(-90)`"
        text-anchor="middle"
      >
        frecuencia relativa
      </text>
      <text class="sc-plot__title" :x="inner.left" :y="15">{{ title }}</text>
    </g>
  </svg>
</template>

<style scoped>
/* The overflow bar aggregates a whole tail, so it is drawn hatched-light to
 * signal that it is not a single value of K like every other bar. */
.sc-mark-bar--overflow {
  opacity: 0.55;
}

.sc-mark-point--overflow {
  opacity: 0.6;
}
</style>
