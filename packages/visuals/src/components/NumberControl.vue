<script setup lang="ts">
import { clampToField, type FieldSpec } from '@simulaciencia/schemas';
import { computed } from 'vue';

/**
 * One schema-driven control. Bounds, step, label and help text all come from
 * the case's `ParamSchema`, so a case can never drift out of sync with its UI.
 */
const props = defineProps<{
  spec: FieldSpec;
  modelValue: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const isSeed = computed(() => props.spec.kind === 'seed');
const min = computed(() => (props.spec.kind === 'seed' ? 0 : props.spec.min));
const max = computed(() => (props.spec.kind === 'seed' ? 4294967295 : props.spec.max));
const step = computed(() => (props.spec.kind === 'seed' ? 1 : props.spec.step));

const displayValue = computed(() => {
  if (props.spec.kind === 'seed') return String(props.modelValue);
  const decimals = props.spec.integer === true ? 0 : props.spec.step < 0.1 ? 3 : 2;
  return props.modelValue.toFixed(decimals);
});

function commit(raw: string): void {
  // Clamping rather than rejecting: dragging a slider must never be able to
  // put the simulation into an invalid state.
  emit('update:modelValue', clampToField(props.spec, Number(raw)));
}
</script>

<template>
  <label class="sc-control" :class="{ 'sc-control--seed': isSeed }">
    <span class="sc-control__header">
      <span class="sc-control__label">{{ spec.label }}</span>
      <span class="sc-control__value">
        {{ displayValue
        }}<template v-if="!isSeed && spec.kind === 'number' && spec.unit">
          {{ spec.unit }}</template
        >
      </span>
    </span>

    <span class="sc-control__row">
      <input
        v-if="!isSeed"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        :aria-label="spec.label"
        @input="commit(($event.target as HTMLInputElement).value)"
      />
      <input
        type="number"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        :aria-label="isSeed ? spec.label : `${spec.label} (exact value)`"
        @change="commit(($event.target as HTMLInputElement).value)"
      />
    </span>

    <span v-if="spec.description" class="sc-hint">{{ spec.description }}</span>
  </label>
</template>

<style scoped>
/* A seed is up to ten digits and has no slider beside it, so it gets the whole
 * row. Anything narrower silently clips the number the student needs to read. */
.sc-control input[type='number'] {
  width: 9ch;
}

.sc-control--seed input[type='number'] {
  width: 100%;
  max-width: 16ch;
}
</style>
