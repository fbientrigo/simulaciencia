<script setup lang="ts">
import { InverseTransformExplorer } from '@simulaciencia/visuals';

/**
 * Slidev auto-imports components from this directory, so the deck writes
 * `<ExplorerSlide />` in Markdown. Keeping a thin local wrapper means slide
 * markup never has to know a package name or an import path.
 */
withDefaults(
  defineProps<{
    seed?: number;
    rate?: number;
    sampleCount?: number;
    revealAll?: boolean;
    showCdf?: boolean;
  }>(),
  { seed: 20260801, rate: 1.5, sampleCount: 1200, revealAll: false, showCdf: true },
);
</script>

<template>
  <div class="sc-root">
    <InverseTransformExplorer
      mode="slide"
      :seed="seed"
      :rate="rate"
      :sample-count="sampleCount"
      :reveal-all="revealAll"
      :show-cdf="showCdf"
      :show-checks="false"
    />
  </div>
</template>
