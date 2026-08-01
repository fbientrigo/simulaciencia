<script setup lang="ts">
import { PoissonCountingLab, type TeachingStage } from '@simulaciencia/visuals';

/**
 * Slidev auto-imports components from this directory, so the deck writes
 * `<PoissonSlide stage="counter" :initial-windows="1" />` in Markdown.
 *
 * The seed and the parameters default to the values the whole of Clase 01
 * uses, so a slide only has to name what makes it different: its teaching
 * stage and how many observations the class arrives to.
 */
withDefaults(
  defineProps<{
    stage: TeachingStage;
    seed?: number;
    rate?: number;
    windowDuration?: number;
    maxWindows?: number;
    initialWindows?: number;
    autoplay?: boolean;
    showParameters?: boolean;
  }>(),
  {
    seed: 20260801,
    rate: 3,
    windowDuration: 1,
    maxWindows: 600,
    initialWindows: 0,
    autoplay: false,
    showParameters: false,
  },
);
</script>

<template>
  <div class="sc-root">
    <PoissonCountingLab
      mode="slide"
      :stage="stage"
      :seed="seed"
      :rate="rate"
      :window-duration="windowDuration"
      :max-windows="maxWindows"
      :initial-windows="initialWindows"
      :autoplay="autoplay"
      :show-parameters="showParameters"
    />
  </div>
</template>
