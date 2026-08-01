<script setup lang="ts">
import {
  SimulationRunner,
  exponentialCdf,
  exponentialMean,
  exponentialVariance,
  maxCdfDeviation,
} from '@simulaciencia/core';
import { inverseTransformCase } from '@simulaciencia/case-inverse-transform';
import { CheckList } from '@simulaciencia/visuals';
import { computed } from 'vue';

/**
 * Empirical versus theoretical, computed live on the slide from a fixed seed.
 *
 * The numbers on screen are produced by the same engine and the same check
 * helpers the unit tests use — nothing here is typed in by hand, so the slide
 * cannot go stale relative to the code.
 */
const props = withDefaults(
  defineProps<{ seed?: number; rate?: number; sampleSizes?: readonly number[] }>(),
  { seed: 20260801, rate: 1.5, sampleSizes: () => [100, 1000, 10000, 50000] },
);

const rows = computed(() =>
  props.sampleSizes.map((n) => {
    const runner = new SimulationRunner(inverseTransformCase, {
      seed: props.seed,
      params: { rate: props.rate, sampleCount: n },
    });
    runner.runToCompletion();
    const metrics = runner.metrics();
    return {
      n,
      mean: metrics.empiricalMean,
      variance: metrics.empiricalVariance,
      standardError: metrics.standardError,
      ks: maxCdfDeviation(runner.snapshot().samples, (x) => exponentialCdf(x, props.rate)),
    };
  }),
);

const checks = computed(() => {
  const largest = new SimulationRunner(inverseTransformCase, {
    seed: props.seed,
    params: { rate: props.rate, sampleCount: 50000 },
  });
  largest.runToCompletion();
  return largest.snapshot().checks;
});

const theoreticalMean = computed(() => exponentialMean(props.rate));
const theoreticalVariance = computed(() => exponentialVariance(props.rate));
</script>

<template>
  <div class="sc-root sc-stack">
    <table class="sc-stats">
      <thead>
        <tr>
          <th scope="col">n</th>
          <th scope="col" class="sc-stats__simulated">mean</th>
          <th scope="col" class="sc-stats__simulated">variance</th>
          <th scope="col">std. error</th>
          <th scope="col">sup |F̂ − F|</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.n">
          <th scope="row">{{ row.n.toLocaleString('en-US') }}</th>
          <td>{{ row.mean.toFixed(4) }}</td>
          <td>{{ row.variance.toFixed(4) }}</td>
          <td>{{ row.standardError.toFixed(4) }}</td>
          <td>{{ row.ks.toFixed(4) }}</td>
        </tr>
        <tr>
          <th scope="row" class="sc-stats__theoretical">theory</th>
          <td class="sc-stats__theoretical">{{ theoreticalMean.toFixed(4) }}</td>
          <td class="sc-stats__theoretical">{{ theoreticalVariance.toFixed(4) }}</td>
          <td>—</td>
          <td>0</td>
        </tr>
      </tbody>
    </table>

    <CheckList :checks="checks" />
  </div>
</template>
