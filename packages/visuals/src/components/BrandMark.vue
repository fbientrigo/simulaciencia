<script setup lang="ts">
import { BRAND } from '@simulaciencia/theme';

/**
 * The SimulaCiencia mark: scattered draws resolving into an ordered curve.
 * Amber points are samples, the blue curve and points are the model they
 * converge to — the same colour contract the plots use.
 */
withDefaults(defineProps<{ size?: number; withWordmark?: boolean }>(), {
  size: 32,
  withWordmark: false,
});
</script>

<template>
  <span class="sc-brand">
    <svg
      class="sc-brand__mark"
      :width="size"
      :height="size"
      viewBox="0 0 32 32"
      role="img"
      :aria-label="BRAND.name"
    >
      <title>{{ BRAND.name }}</title>
      <path
        d="M4 19.4 C 7.5 15.2, 9.5 12.4, 12 10.3 S 18.5 6.9, 28 5.1"
        fill="none"
        stroke="var(--sc-theoretical)"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.9"
      />
      <g fill="var(--sc-simulated)">
        <circle cx="5.2" cy="24.6" r="1.7" />
        <circle cx="7.5" cy="9.8" r="1.5" />
        <circle cx="10.5" cy="21.5" r="1.5" />
        <circle cx="13.8" cy="14.6" r="1.3" />
      </g>
      <g fill="var(--sc-theoretical)">
        <circle cx="17" cy="8.6" r="1.3" />
        <circle cx="21.5" cy="6.4" r="1.2" />
        <circle cx="26" cy="5.3" r="1.2" />
      </g>
    </svg>

    <span v-if="withWordmark" class="sc-brand__word">
      <span class="sc-brand__name">{{ BRAND.name }}</span>
      <span class="sc-brand__tagline">{{ BRAND.tagline }}</span>
    </span>
  </span>
</template>

<style scoped>
.sc-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--sc-space-2);
}

.sc-brand__mark {
  flex: 0 0 auto;
}

.sc-brand__word {
  display: grid;
  line-height: 1.15;
}

.sc-brand__name {
  font-weight: 680;
  letter-spacing: -0.015em;
  color: var(--sc-text);
}

.sc-brand__tagline {
  font-size: var(--sc-text-xs);
  letter-spacing: 0.04em;
  color: var(--sc-text-muted);
}
</style>
