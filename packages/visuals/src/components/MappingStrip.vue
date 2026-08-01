<script setup lang="ts">
import type { SamplePair } from '@simulaciencia/case-inverse-transform';
import { computed } from 'vue';
import { formatTick, linearScale, ticks } from '../plot/scale.ts';

/**
 * The synchronized U → X display.
 *
 * Top rail is the uniform draw on (0,1); bottom rail is the exponential variate
 * it becomes. A link joins the two, so the student watches the transform act on
 * one specific number rather than on an abstract distribution. Uniform spacing
 * on top becomes bunched-near-zero spacing at the bottom — that visual is the
 * whole intuition behind inverse transform sampling.
 */
const props = withDefaults(
  defineProps<{
    uniforms: readonly number[];
    samples: readonly number[];
    recent: readonly SamplePair[];
    latest: SamplePair | null;
    xMax: number;
    width?: number;
    height?: number;
    /** Cap on faint background marks, so 50 000 samples still render fast. */
    maxGhosts?: number;
  }>(),
  { width: 480, height: 190, maxGhosts: 400 },
);

const PAD = 46;
/**
 * Rail positions are proportional, not fixed, so the strip stays legible when a
 * slide asks for a shorter box — at a fixed 138 the lower rail collided with the
 * caption as soon as the height dropped below ~170.
 */
const TOP_RAIL = computed(() => props.height * 0.3);
const BOTTOM_RAIL = computed(() => props.height * 0.74);

const uScale = computed(() => linearScale([0, 1], [PAD, props.width - PAD / 2]));
const xScale = computed(() => linearScale([0, props.xMax], [PAD, props.width - PAD / 2]));

const uTicks = computed(() => ticks([0, 1], 5));
const xTicks = computed(() => ticks([0, props.xMax], 5));

/** Evenly thinned so the ghost rails stay representative, not just the tail. */
function thin(values: readonly number[]): readonly number[] {
  if (values.length <= props.maxGhosts) return values;
  const stride = values.length / props.maxGhosts;
  const out: number[] = [];
  for (let i = 0; i < props.maxGhosts; i += 1) {
    out.push(values[Math.floor(i * stride)] as number);
  }
  return out;
}

const ghostUniforms = computed(() => thin(props.uniforms));
const ghostSamples = computed(() => thin(props.samples));

/** A gentle S-curve rather than a straight line, so crossing links stay readable. */
function linkPath(u: number, x: number): string {
  const x0 = uScale.value(u);
  const x1 = xScale.value(x);
  const top = TOP_RAIL.value;
  const bottom = BOTTOM_RAIL.value;
  const mid = (top + bottom) / 2;
  return `M${x0.toFixed(2)} ${top + 6} C ${x0.toFixed(2)} ${mid}, ${x1.toFixed(2)} ${mid}, ${x1.toFixed(2)} ${bottom - 6}`;
}
</script>

<template>
  <svg
    class="sc-plot"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="Uniform draws mapped to exponential variates"
  >
    <title>Uniform draws mapped to exponential variates</title>

    <text class="sc-plot__axis-label" :x="PAD" :y="22">U ~ Uniform(0, 1)</text>
    <text class="sc-plot__axis-label" :x="PAD" :y="height - 8">
      X = −ln(1 − U) / λ ~ Exponential(λ)
    </text>

    <!-- Uniform rail -->
    <line class="sc-plot__axis" :x1="PAD" :x2="width - PAD / 2" :y1="TOP_RAIL" :y2="TOP_RAIL" />
    <g aria-hidden="true">
      <g v-for="t in uTicks" :key="`u-${t}`">
        <line
          class="sc-plot__axis"
          :x1="uScale(t)"
          :x2="uScale(t)"
          :y1="TOP_RAIL - 4"
          :y2="TOP_RAIL"
        />
        <text class="sc-plot__tick" :x="uScale(t)" :y="TOP_RAIL - 8" text-anchor="middle">
          {{ formatTick(t) }}
        </text>
      </g>
    </g>

    <!-- Exponential rail -->
    <line
      class="sc-plot__axis"
      :x1="PAD"
      :x2="width - PAD / 2"
      :y1="BOTTOM_RAIL"
      :y2="BOTTOM_RAIL"
    />
    <g aria-hidden="true">
      <g v-for="t in xTicks" :key="`x-${t}`">
        <line
          class="sc-plot__axis"
          :x1="xScale(t)"
          :x2="xScale(t)"
          :y1="BOTTOM_RAIL"
          :y2="BOTTOM_RAIL + 4"
        />
        <text class="sc-plot__tick" :x="xScale(t)" :y="BOTTOM_RAIL + 16" text-anchor="middle">
          {{ formatTick(t) }}
        </text>
      </g>
    </g>

    <!-- Every draw so far, faint. -->
    <g opacity="0.35">
      <line
        v-for="(u, i) in ghostUniforms"
        :key="`gu-${i}`"
        class="sc-mark-rule"
        stroke-dasharray="none"
        :x1="uScale(u)"
        :x2="uScale(u)"
        :y1="TOP_RAIL - 3"
        :y2="TOP_RAIL + 3"
      />
      <line
        v-for="(x, i) in ghostSamples"
        :key="`gx-${i}`"
        class="sc-mark-rule"
        stroke-dasharray="none"
        :x1="xScale(x)"
        :x2="xScale(x)"
        :y1="BOTTOM_RAIL - 3"
        :y2="BOTTOM_RAIL + 3"
      />
    </g>

    <!-- The recent window, linked. -->
    <g>
      <path
        v-for="pair in recent"
        :key="`link-${pair.index}`"
        class="sc-mark-link"
        :class="{ 'sc-mark-link--latest': latest !== null && pair.index === latest.index }"
        :d="linkPath(pair.u, pair.x)"
      />
      <circle
        v-for="pair in recent"
        :key="`pu-${pair.index}`"
        class="sc-mark-point"
        :class="{ 'sc-mark-point--latest': latest !== null && pair.index === latest.index }"
        :cx="uScale(pair.u)"
        :cy="TOP_RAIL + 6"
        :r="latest !== null && pair.index === latest.index ? 4.5 : 2.5"
      />
      <circle
        v-for="pair in recent"
        :key="`px-${pair.index}`"
        class="sc-mark-point"
        :class="{ 'sc-mark-point--latest': latest !== null && pair.index === latest.index }"
        :cx="xScale(pair.x)"
        :cy="BOTTOM_RAIL - 6"
        :r="latest !== null && pair.index === latest.index ? 4.5 : 2.5"
      />
    </g>

    <!-- Read out the exact pair currently being transformed. -->
    <text v-if="latest" class="sc-mark-value" :x="width - PAD / 2" :y="22" text-anchor="end">
      U = {{ latest.u.toFixed(4) }} → X = {{ latest.x.toFixed(4) }}
    </text>
  </svg>
</template>
