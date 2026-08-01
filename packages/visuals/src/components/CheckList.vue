<script setup lang="ts">
import { allPassed, type CheckResult } from '@simulaciencia/core';
import { computed } from 'vue';

/**
 * Renders the very same `CheckResult` objects the unit tests assert on.
 * A student watching the slide sees the project's own acceptance criteria.
 */
const props = defineProps<{
  checks: readonly CheckResult[];
  showDetail?: boolean;
}>();

const everythingPassed = computed(() => allPassed(props.checks));
</script>

<template>
  <div class="sc-panel" :class="everythingPassed ? 'sc-panel--result' : 'sc-panel--warning'">
    <span class="sc-panel__label">
      {{ everythingPassed ? 'Validated' : 'Not yet validated' }}
    </span>
    <ul class="sc-checks">
      <li
        v-for="check in checks"
        :key="check.label"
        class="sc-check"
        :class="check.ok ? 'sc-check--pass' : 'sc-check--fail'"
      >
        <span class="sc-check__mark" aria-hidden="true">{{ check.ok ? '✓' : '✕' }}</span>
        <span>
          {{ check.label }}
          <span class="sc-visually-hidden">{{ check.ok ? ' — passed' : ' — failed' }}</span>
          <span v-if="showDetail !== false" class="sc-check__detail">{{ check.detail }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sc-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
