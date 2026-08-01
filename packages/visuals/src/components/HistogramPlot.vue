<script setup lang="ts">
import type { CurvePoint, Histogram } from '@simulaciencia/core';
import { computed } from 'vue';
import { linePath, type Scale } from '../plot/scale.ts';
import PlotFrame from './PlotFrame.vue';

/**
 * Simulated histogram against the closed-form density.
 *
 * The histogram is normalised to a DENSITY, not a count, which is the only way
 * the two can share a y-axis honestly — that comparison is the point of the
 * whole plot.
 */
const props = withDefaults(
  defineProps<{
    histogram: Histogram;
    density: readonly CurvePoint[];
    title?: string | undefined;
    xLabel?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }>(),
  { width: 480, height: 280, xLabel: 'x' },
);

const xDomain = computed<[number, number]>(() => [props.histogram.min, props.histogram.max]);

const yDomain = computed<[number, number]>(() => {
  const peakBar = props.histogram.bins.reduce((max, b) => Math.max(max, b.density), 0);
  const peakCurve = props.density.reduce((max, p) => Math.max(max, p.y), 0);
  const peak = Math.max(peakBar, peakCurve);
  return [0, peak > 0 ? peak * 1.1 : 1];
});

function curvePath(xScale: Scale, yScale: Scale): string {
  return linePath(props.density, xScale, yScale);
}

function barGeometry(
  bin: Histogram['bins'][number],
  xScale: Scale,
  yScale: Scale,
  floor: number,
): { x: number; y: number; width: number; height: number } {
  const x0 = xScale(bin.start);
  const x1 = xScale(bin.end);
  const y = yScale(bin.density);
  return {
    x: Math.min(x0, x1),
    // A 1px inset keeps adjacent bars visually separated without a gap hack.
    width: Math.max(0.5, Math.abs(x1 - x0) - 1),
    y,
    height: Math.max(0, floor - y),
  };
}
</script>

<template>
  <PlotFrame
    v-slot="{ xScale, yScale, inner }"
    :x-domain="xDomain"
    :y-domain="yDomain"
    :x-label="xLabel"
    y-label="density"
    :title="title"
    :width="width"
    :height="height"
  >
    <rect
      v-for="bin in histogram.bins"
      :key="bin.index"
      class="sc-mark-bar"
      v-bind="barGeometry(bin, xScale, yScale, inner.top + inner.height)"
    />
    <path class="sc-mark-curve" :d="curvePath(xScale, yScale)" />
  </PlotFrame>
</template>
