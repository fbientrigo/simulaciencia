<script setup lang="ts">
/**
 * The five pedagogical panels, available to Markdown as
 * `<Panel kind="exercise" label="Try it">…</Panel>`.
 */
withDefaults(
  defineProps<{
    kind?: 'equation' | 'definition' | 'exercise' | 'warning' | 'result';
    label?: string;
  }>(),
  { kind: 'definition' },
);

const DEFAULT_LABELS: Record<string, string> = {
  equation: 'Model',
  definition: 'Definition',
  exercise: 'Exercise',
  warning: 'Careful',
  result: 'Result',
};
</script>

<template>
  <div class="sc-root">
    <div class="sc-panel" :class="`sc-panel--${kind}`">
      <span class="sc-panel__label">{{ label ?? DEFAULT_LABELS[kind] }}</span>
      <div class="sc-panel__body"><slot /></div>
    </div>
  </div>
</template>
