<script setup lang="ts">
import type { PoissonCountingSnapshot } from '@simulaciencia/case-poisson-counting';
import { computed } from 'vue';

/**
 * The `diagnostics` stage: what the numbers say, not what the picture suggests.
 *
 * This does not reuse `CheckList`, whose panel headings are English — every
 * string a student reads in this lesson has to be Spanish, and the check
 * statements themselves already arrive translated from the case.
 *
 * The readiness state is deliberately loud. Below the case's minimum window
 * count the unbiased variance of a Poisson sample is noisy enough that a
 * perfectly correct generator regularly looks broken, and a student reading a
 * Fano factor of 0.6 off a 5-window sample learns the wrong lesson.
 */
const props = defineProps<{ snapshot: PoissonCountingSnapshot }>();

/** Undefined below two observations; the panel prints an em dash instead. */
function show(value: number, minimumWindows: number, digits = 3): string {
  if (props.snapshot.revealedWindows < minimumWindows) return '—';
  return value.toFixed(digits);
}

const rows = computed(() => [
  {
    key: 'mean',
    label: 'Media empírica',
    observed: show(props.snapshot.empiricalMean, 1),
    expected: props.snapshot.expectedMean.toFixed(3),
  },
  {
    key: 'variance',
    label: 'Varianza insesgada',
    observed: show(props.snapshot.empiricalVariance, 2),
    expected: props.snapshot.expectedVariance.toFixed(3),
  },
  {
    key: 'fano',
    label: 'Factor de Fano',
    observed: show(props.snapshot.fanoFactor, 2),
    expected: (1).toFixed(3),
  },
]);

const everythingPassed = computed(
  () => props.snapshot.diagnosticsReady && props.snapshot.checks.every((c) => c.ok),
);
</script>

<template>
  <div class="sc-stack" data-testid="poisson-diagnostics">
    <table class="sc-stats">
      <caption class="sc-caption">
        Tras
        {{
          snapshot.revealedWindows
        }}
        ventanas. El modelo de Poisson predice μ para la media y para la varianza, y por lo tanto 1
        para el cociente entre ambas.
      </caption>
      <thead>
        <tr>
          <th scope="col">Cantidad</th>
          <th scope="col" class="sc-stats__simulated">Observado</th>
          <th scope="col" class="sc-stats__theoretical">Esperado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td :data-testid="`diagnostic-${row.key}`">{{ row.observed }}</td>
          <td class="sc-stats__theoretical">{{ row.expected }}</td>
        </tr>
      </tbody>
    </table>

    <div
      class="sc-panel"
      :class="everythingPassed ? 'sc-panel--result' : 'sc-panel--warning'"
      data-testid="poisson-diagnostics-verdict"
    >
      <span class="sc-panel__label">
        {{ everythingPassed ? 'Verificado' : 'Todavía no verificado' }}
      </span>

      <p v-if="!snapshot.diagnosticsReady" class="sc-hint">
        Se necesitan al menos {{ snapshot.minimumDiagnosticWindows }} ventanas observadas para que
        estos números signifiquen algo. Llevamos {{ snapshot.revealedWindows }}. Con muy pocas
        observaciones, una simulación correcta parece rota.
      </p>

      <ul v-else class="sc-checks">
        <li
          v-for="check in snapshot.checks"
          :key="check.label"
          class="sc-check"
          :class="check.ok ? 'sc-check--pass' : 'sc-check--fail'"
        >
          <span class="sc-check__mark" aria-hidden="true">{{ check.ok ? '✓' : '✕' }}</span>
          <span>
            {{ check.label }}
            <span class="sc-diagnostics__sr">{{ check.ok ? ' — cumple' : ' — no cumple' }}</span>
            <span class="sc-check__detail">{{ check.detail }}</span>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* A fixed layout keeps the three columns inside the control column of a 16:9
 * slide. Without it the longest label sets the width and the "Esperado" column
 * is the one that gets clipped — which is exactly the comparison the stage is
 * about. */
.sc-stats {
  table-layout: fixed;
  width: 100%;
}

.sc-stats th:first-child {
  width: 34%;
}

/* "OBSERVADO" and "ESPERADO" are unbreakable words. Uppercasing and tracking
 * them — which the theme does for the wide tables in the other lessons — makes
 * the pair too wide for the control column of a slide, and they collide.
 * Sentence case is both narrower and, here, easier to read at projector size. */
.sc-stats thead th {
  text-transform: none;
  letter-spacing: 0;
}

.sc-diagnostics__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
