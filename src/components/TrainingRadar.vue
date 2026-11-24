<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { axes } from '../data/catalog.js'
const props = defineProps({
  data: { type: Object, required: true },
  actual: Boolean,
  title: String,
})
const { t, n } = useI18n(),
  mode = ref('sets')
const point = (i, v) => [
  160 + Math.sin((i * Math.PI) / 3) * v,
  145 - Math.cos((i * Math.PI) / 3) * v,
]
const polygon = (r) => axes.map((_, i) => point(i, r).join(',')).join(' ')
const max = computed(() =>
  mode.value === 'percent' ? 100 : Math.max(1, ...Object.values(props.data.values)),
)
const shape = computed(() =>
  axes
    .map((a, i) =>
      point(
        i,
        ((mode.value === 'percent' ? props.data.percent[a] : props.data.values[a]) / max.value) *
          96,
      ).join(','),
    )
    .join(' '),
)
</script>
<template>
  <section class="radar-block">
    <div class="section-heading">
      <h3>{{ title || t('distribution') }}</h3>
      <select v-model="mode" :aria-label="t('chartMode')">
        <option value="sets">{{ t('sets') }}</option>
        <option value="percent">{{ t('percent') }}</option>
      </select>
    </div>
    <p class="muted small">
      <span class="legend-dot" :class="{ yellow: actual }" />{{ t(actual ? 'actual' : 'planned') }}
    </p>
    <svg class="radar" viewBox="0 0 320 295" role="img" :aria-label="t('distribution')">
      <polygon
        v-for="r in [24, 48, 72, 96]"
        :key="r"
        :points="polygon(r)"
        fill="none"
        stroke="var(--color-divider)"
      />
      <line
        v-for="(_, i) in axes"
        :key="i"
        x1="160"
        y1="145"
        :x2="point(i, 96)[0]"
        :y2="point(i, 96)[1]"
        stroke="var(--color-divider)"
      />
      <polygon
        :points="shape"
        :fill="actual ? 'var(--color-accent-fill)' : 'var(--color-primary-fill)'"
        :stroke="actual ? 'var(--color-accent-line)' : 'var(--color-primary)'"
        stroke-width="2.5"
      />
      <text
        v-for="(axis, i) in axes"
        :key="axis"
        :x="point(i, 125)[0]"
        :y="point(i, 125)[1] + 4"
        text-anchor="middle"
        fill="var(--color-text-muted)"
        font-size="12"
      >
        {{ t('labels.' + axis) }}
      </text>
    </svg>
    <p v-if="!data.total" class="muted center">{{ t('noData') }}</p>
    <div class="radar-values">
      <div v-for="axis in axes" :key="axis">
        <RouterLink :to="'/exercises?part=' + axis">{{ t('labels.' + axis) }}</RouterLink><b>{{
          n(data.values[axis], { maximumFractionDigits: 1 })
        }}</b
        ><span>{{ n(data.percent[axis], { maximumFractionDigits: 1 }) }}%</span>
      </div>
    </div>
    <div class="radar-total">
      <span
        >{{ t('total') }} <b>{{ n(data.total, { maximumFractionDigits: 1 }) }}</b></span
      ><span>{{ t('unclassified') }} {{ data.unclassified }}</span>
    </div>
  </section>
</template>
