<script setup lang="ts">
import { DecayChamber3D } from '@simulaciencia/visuals';

withDefaults(
  defineProps<{
    seed?: number;
    initialCount?: number;
    rate?: number;
    speed?: number;
    showChecks?: boolean;
  }>(),
  { seed: 20260801, initialCount: 400, rate: 0.35, speed: 1, showChecks: false },
);
</script>

<template>
  <div class="sc-root">
    <DecayChamber3D
      mode="slide"
      :seed="seed"
      :initial-count="initialCount"
      :rate="rate"
      :speed="speed"
      :show-checks="showChecks"
    />
  </div>
</template>
