<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '../stores/app.js'
import { datesBetween, dailyStats, localDate } from '../services/domain.js'
import DateRangeFilter from './DateRangeFilter.vue'
const store = useAppStore(),
  { t, n } = useI18n(),
  today = localDate(new Date(), store.data.settings.timeZone),
  end = ref(today),
  start = ref(
    new Date(new Date(today + 'T00:00:00Z').getTime() - 6 * 86400000).toISOString().slice(0, 10),
  ),
  visible = ref(['consumed', 'resting', 'net'])
const keys = ['consumed', 'resting', 'net'],
  labels = { consumed: 'intake', resting: 'resting', net: 'net' },
  colors = { consumed: 'var(--color-primary)', resting: 'var(--color-accent-line)', net: 'var(--palette-slate)' }
const rows = computed(() =>
  datesBetween(start.value, end.value).map((date) => ({
    date,
    ...dailyStats(store.data, date),
  })),
)
const complete = computed(() => rows.value.filter((r) => r.complete && r.date < today))
const total = computed(() => complete.value.reduce((sum, r) => sum + r.balance, 0))
const max = computed(() => Math.max(1, ...rows.value.flatMap((r) => keys.map((k) => r[k] || 0))))
function x(i) {
  return 40 + (i / Math.max(1, rows.value.length - 1)) * 600
}
function y(v) {
  return 190 - (v / max.value) * 160
}
const segments = computed(() =>
  Object.fromEntries(
    keys.map((k) => {
      const chunks = []
      let points = []
      rows.value.forEach((r, i) => {
        const v = k === 'consumed' && !store.data.meals.some((m) => m.date === r.date) ? null : r[k]
        if (v === null) {
          if (points.length) chunks.push(points.join(' '))
          points = []
        } else points.push(x(i) + ',' + y(v))
      })
      if (points.length) chunks.push(points.join(' '))
      return [k, chunks]
    }),
  ),
)
</script>
<template>
  <section class="panel energy-stats">
    <h2>{{ t('nutritionStats') }}</h2>
    <DateRangeFilter v-model:start="start" v-model:end="end" :today="today" />
    <div class="chart-legend">
      <label v-for="k in keys" :key="k" class="checkbox"
        ><input type="checkbox" :value="k" v-model="visible" /><span :style="{ color: colors[k] }"
          >●</span
        >{{ t(labels[k]) }}</label
      >
    </div>
    <svg class="energy-chart" viewBox="0 0 680 225" role="img" :aria-label="t('nutritionStats')">
      <g v-for="i in [0, 1, 2, 3]" :key="i">
        <line x1="40" x2="650" :y1="30 + i * 53" :y2="30 + i * 53" stroke="var(--color-divider)" />
        <text x="2" :y="34 + i * 53" font-size="11" fill="var(--color-text-muted)">
          {{ Math.round(max * (1 - i / 3)) }}
        </text>
      </g>
      <template v-for="k in visible" :key="k">
        <polyline
          v-for="(s, i) in segments[k]"
          :key="i"
          :points="s"
          fill="none"
          :stroke="colors[k]"
          :stroke-dasharray="k === 'resting' ? '5 4' : undefined"
          stroke-width="2.5"
        />
        <template v-for="(r, i) in rows" :key="r.date">
          <circle
            v-if="
              r[k] !== null && (k !== 'consumed' || store.data.meals.some((m) => m.date === r.date))
            "
            :cx="x(i)"
            :cy="y(r[k])"
            r="3"
            :fill="colors[k]"
          />
        </template>
      </template>
      <text x="40" y="215" fill="var(--color-text-muted)" font-size="11">{{ start }}</text>
      <text x="640" y="215" text-anchor="end" fill="var(--color-text-muted)" font-size="11">
        {{ end }}
      </text>
    </svg>
    <div class="metric-grid three">
      <div>
        <p class="muted">{{ t('completeDays') }}</p>
        <b>{{ complete.length }} / {{ rows.length }}</b>
      </div>
      <div>
        <p class="muted">{{ t('balance') }}</p>
        <b>{{ complete.length ? n(total, { maximumFractionDigits: 0 }) + ' kcal' : '—' }}</b>
      </div>
      <div>
        <p class="muted">{{ t('equivalent') }}</p>
        <b>{{ complete.length ? n(total / 7700, { maximumFractionDigits: 1 }) + ' kg' : '—' }}</b>
      </div>
    </div>
    <p class="small muted">
      {{ t('average') }} · {{ t('balance') }}:
      {{
        complete.length ? n(total / complete.length, { maximumFractionDigits: 0 }) + ' kcal' : '—'
      }}
      · {{ t('provisional') }}
    </p>
    <p class="callout small">{{ t('estimateNote') }}</p>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{{ t('date') }}</th>
            <th v-for="k in keys" :key="k">{{ t(labels[k]) }}</th>
            <th>{{ t('balance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.date">
            <td>{{ r.date }}{{ r.date === today ? ' *' : '' }}</td>
            <td v-for="k in keys" :key="k">
              {{
                r[k] === null ||
                (k === 'consumed' && !store.data.meals.some((m) => m.date === r.date))
                  ? '—'
                  : n(r[k], { maximumFractionDigits: 0 })
              }}
            </td>
            <td>
              {{ r.balance === null ? '—' : n(r.balance, { maximumFractionDigits: 0 }) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
