<script setup lang="ts">
import { BRAND } from '@simulaciencia/theme';
import { BrandMark } from '@simulaciencia/visuals';

defineProps<{ subtitle?: string; course?: string }>();
</script>

<template>
  <div class="sc-root sc-slide sc-slide--cover title-slide">
    <BrandMark :size="88" />
    <div>
      <h1 class="title-slide__name">{{ BRAND.name }}</h1>
      <p class="title-slide__tagline">{{ BRAND.tagline }}</p>
    </div>
    <p v-if="subtitle" class="sc-subtitle">{{ subtitle }}</p>
    <p v-if="course" class="sc-caption">{{ course }}</p>
  </div>
</template>

<style scoped>
.title-slide {
  padding: var(--sc-space-6) 0;
}

.title-slide__name {
  font-size: var(--sc-text-3xl);
  font-weight: 680;
  letter-spacing: -0.02em;
  line-height: 1.05;
  margin: 0;
  color: var(--sc-text);
}

.title-slide__tagline {
  margin: var(--sc-space-2) 0 0;
  font-size: var(--sc-text-lg);
  letter-spacing: 0.06em;
  color: var(--sc-theoretical-text);
}
</style>
