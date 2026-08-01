<script setup lang="ts">
import type { CurvePoint } from '@simulaciencia/core';
import type { SurvivalPoint } from '@simulaciencia/case-radioactive-decay';
import { computed } from 'vue';
import { linePath, type Scale } from '../plot/scale.ts';
import PlotFrame from './PlotFrame.vue';

/**
 * The 2D companion to the 3D chamber: simulated survival fraction against
 * e^(−λt). Both read the same snapshot, so the curve head and the chamber are
 * synchronized by construction rather than by a shared timer.
 */
const props = withDefaults(
  defineProps<{
    empirical: readonly SurvivalPoint[];
    theoretical: readonly CurvePoint[];
    horizon: number;
    halfLife: number;
    currentTime: number;
    currentFraction: number;
    title?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }>(),
  { width: 480, height: 260 },
);

const xDomain = computed<[number, number]>(() => [0, props.horizon]);

function empiricalPath(xScale: Scale, yScale: Scale): string {
  return linePath<SurvivalPoint>(
    props.empirical,
    xScale,
    yScale,
    (p) => p.t,
    (p) => p.fraction,
  );
}

function theoreticalPath(xScale: Scale, yScale: Scale): string {
  return linePath(props.theoretical, xScale, yScale);
}
</script>

<template>
  <PlotFrame
    v-slot="{ xScale, yScale, inner }"
    :x-domain="xDomain"
    :y-domain="[0, 1]"
    x-label="simulation time t (s)"
    y-label="N(t) / N₀"
    :title="title ?? 'Survival fraction'"
    :width="width"
    :height="height"
  >
    <!-- Half-life reference, the number students are asked to read off. -->
    <line
      v-if="halfLife <= horizon"
      class="sc-mark-rule"
      :x1="xScale(halfLife)"
      :x2="xScale(halfLife)"
      :y1="inner.top"
      :y2="inner.top + inner.height"
    />
    <text
      v-if="halfLife <= horizon"
      class="sc-plot__tick"
      :x="xScale(halfLife) + 4"
      :y="inner.top + 12"
    >
      t½ = {{ halfLife.toFixed(2) }}s
    </text>

    <path class="sc-mark-curve sc-mark-curve--reference" :d="theoreticalPath(xScale, yScale)" />
    <path class="sc-mark-curve sc-mark-curve--empirical" :d="empiricalPath(xScale, yScale)" />

    <!-- The head of the simulated curve: where "now" is. -->
    <circle
      class="sc-mark-point--latest"
      :cx="xScale(currentTime)"
      :cy="yScale(currentFraction)"
      r="4"
    />
  </PlotFrame>
</template>
