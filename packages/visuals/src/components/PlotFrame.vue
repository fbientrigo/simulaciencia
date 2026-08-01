<script setup lang="ts">
import { computed } from 'vue';
import { formatTick, linearScale, ticks, type Scale } from '../plot/scale.ts';

/**
 * Axes, grid and labels for a hand-written SVG plot.
 *
 * Every plot in the project sits inside this, and receives ready-made scales
 * through the default slot. The SVG uses a fixed internal coordinate system and
 * a `viewBox`, so one plot renders correctly at slide, embed and vertical
 * capture sizes without any resize observer.
 */
const props = withDefaults(
  defineProps<{
    xDomain: readonly [number, number];
    yDomain: readonly [number, number];
    // `| undefined` is explicit because the workspace runs with
    // `exactOptionalPropertyTypes`, and a parent forwarding its own optional
    // prop passes `string | undefined` rather than omitting the attribute.
    xLabel?: string | undefined;
    yLabel?: string | undefined;
    title?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    xTickCount?: number | undefined;
    yTickCount?: number | undefined;
  }>(),
  { width: 480, height: 280, xTickCount: 6, yTickCount: 5 },
);

const margin = { top: 22, right: 14, bottom: 40, left: 52 };

const inner = computed(() => ({
  left: margin.left,
  top: margin.top,
  width: Math.max(1, props.width - margin.left - margin.right),
  height: Math.max(1, props.height - margin.top - margin.bottom),
}));

const xScale = computed<Scale>(() =>
  linearScale(props.xDomain, [inner.value.left, inner.value.left + inner.value.width]),
);

const yScale = computed<Scale>(() =>
  linearScale(props.yDomain, [inner.value.top + inner.value.height, inner.value.top]),
);

const xTicks = computed(() => ticks(props.xDomain, props.xTickCount));
const yTicks = computed(() => ticks(props.yDomain, props.yTickCount));
</script>

<template>
  <svg
    class="sc-plot"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="title ?? `${xLabel ?? 'x'} versus ${yLabel ?? 'y'}`"
  >
    <title v-if="title">{{ title }}</title>

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
        :y1="yScale(t)"
        :y2="yScale(t)"
      />
    </g>

    <!-- Plot marks are drawn by the caller, on top of the grid. -->
    <g :clip-path="undefined">
      <slot :x-scale="xScale" :y-scale="yScale" :inner="inner" />
    </g>

    <g aria-hidden="true">
      <line
        class="sc-plot__axis"
        :x1="inner.left"
        :x2="inner.left + inner.width"
        :y1="inner.top + inner.height"
        :y2="inner.top + inner.height"
      />
      <line
        class="sc-plot__axis"
        :x1="inner.left"
        :x2="inner.left"
        :y1="inner.top"
        :y2="inner.top + inner.height"
      />

      <g v-for="t in xTicks" :key="`tx-${t}`">
        <line
          class="sc-plot__axis"
          :x1="xScale(t)"
          :x2="xScale(t)"
          :y1="inner.top + inner.height"
          :y2="inner.top + inner.height + 4"
        />
        <text
          class="sc-plot__tick"
          :x="xScale(t)"
          :y="inner.top + inner.height + 16"
          text-anchor="middle"
        >
          {{ formatTick(t) }}
        </text>
      </g>

      <g v-for="t in yTicks" :key="`ty-${t}`">
        <text class="sc-plot__tick" :x="inner.left - 7" :y="yScale(t) + 3.5" text-anchor="end">
          {{ formatTick(t) }}
        </text>
      </g>

      <text
        v-if="xLabel"
        class="sc-plot__axis-label"
        :x="inner.left + inner.width / 2"
        :y="height - 6"
        text-anchor="middle"
      >
        {{ xLabel }}
      </text>
      <text
        v-if="yLabel"
        class="sc-plot__axis-label"
        :transform="`translate(12, ${inner.top + inner.height / 2}) rotate(-90)`"
        text-anchor="middle"
      >
        {{ yLabel }}
      </text>
      <text v-if="title" class="sc-plot__title" :x="inner.left" :y="14">{{ title }}</text>
    </g>
  </svg>
</template>
