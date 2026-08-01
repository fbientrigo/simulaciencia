<script setup lang="ts">
import type { CdfPoint, CurvePoint } from '@simulaciencia/core';
import { linePath, stepPath, type Scale } from '../plot/scale.ts';
import PlotFrame from './PlotFrame.vue';

/**
 * Empirical CDF (step, amber) against the theoretical CDF (smooth, blue).
 * Where the two separate is exactly the Kolmogorov–Smirnov distance the
 * metrics panel reports.
 */
const props = withDefaults(
  defineProps<{
    empirical: readonly CdfPoint[];
    theoretical: readonly CurvePoint[];
    xMax: number;
    title?: string | undefined;
    xLabel?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }>(),
  { width: 480, height: 280, xLabel: 'x' },
);

function empiricalPath(xScale: Scale, yScale: Scale): string {
  return stepPath(props.empirical, xScale, yScale);
}

function theoreticalPath(xScale: Scale, yScale: Scale): string {
  return linePath(props.theoretical, xScale, yScale);
}
</script>

<template>
  <PlotFrame
    v-slot="{ xScale, yScale }"
    :x-domain="[0, xMax]"
    :y-domain="[0, 1]"
    :x-label="xLabel"
    y-label="F(x)"
    :title="title"
    :width="width"
    :height="height"
  >
    <path class="sc-mark-curve sc-mark-curve--reference" :d="theoreticalPath(xScale, yScale)" />
    <path class="sc-mark-curve sc-mark-curve--empirical" :d="empiricalPath(xScale, yScale)" />
  </PlotFrame>
</template>
