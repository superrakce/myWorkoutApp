<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { restingEstimate } from '../../services/domain.js'
const props = defineProps({
  measurement: { type: Object, required: true },
  profile: { type: Object, required: true },
  date: { type: String, required: true },
})
const { t, n } = useI18n()
const estimate = computed(() => restingEstimate(props.measurement, props.profile, props.date))
const bmi = computed(() => {
  const { weight, height } = props.measurement
  return weight > 0 && height > 0 ? weight / (height / 100) ** 2 : null
})
const lean = computed(() => {
  const { weight, bodyFat } = props.measurement
  return weight > 0 && bodyFat !== '' && bodyFat != null &&
    Number.isFinite(Number(bodyFat)) && bodyFat >= 0 && bodyFat <= 100
    ? weight * (1 - bodyFat / 100) : null
})
const values = computed(() => [
  { key: 'bmi', value: bmi.value, decimals: 1 },
  { key: 'lean', value: lean.value, decimals: 1 },
  { key: 'estimatedRmrField', value: estimate.value.value, decimals: 0 },
])
</script>
<template>
  <fieldset class="calculated-fields">
    <legend>{{ t('autoCalculated') }}</legend>
    <p class="small muted">{{ t('calculatedHint') }}</p>
    <div class="form-grid three">
      <label v-for="field in values" :key="field.key">
        {{ t(field.key) }}
        <input
          type="text"
          readonly
          :value="field.value === null ? '—' : n(field.value, { maximumFractionDigits: field.decimals })"
          :data-testid="'calculated-' + field.key"
        />
      </label>
    </div>
    <p v-if="estimate.reason === 'missing'" class="small muted" data-testid="estimate-help">
      {{ t('rmrMissing', { fields: estimate.missing.map((key) => t(key)).join('、') }) }}
    </p>
    <p v-else-if="estimate.reason" class="small muted" data-testid="estimate-help">
      {{ t(estimate.reason === 'ageRange' ? 'rmrAgeRange' : 'rmrDateInvalid') }}
    </p>
  </fieldset>
</template>
<style scoped>
.calculated-fields { border: 1px solid var(--color-border); border-radius: 12px; padding: 1rem; margin: 1rem 0; min-width: 0; }
.calculated-fields input[readonly] { background: var(--color-primary-soft); color: var(--color-text); cursor: default; }
</style>
