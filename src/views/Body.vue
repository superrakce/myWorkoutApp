<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2, Pencil } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { uid, localDate, clone, rmr, restingEstimate, measurementAt } from '../services/domain.js'
import { profileAtMeasurement } from '../services/bodyProfile.js'
import CalculatedBodyFields from '../components/body/CalculatedBodyFields.vue'
const store = useAppStore(),
  { t, n } = useI18n(),
  profile = ref(clone(store.data.profile)),
  invalid = ref(false),
  saved = ref(false),
  profileFields = ref(null)
const initial = () => ({
    measuredAt: localDate(new Date(), store.data.settings.timeZone) + 'T12:00',
    height: '',
    weight: '',
    bodyFat: '',
    fatMass: '',
    muscle: '',
    skeletal: '',
    waist: '',
    rmr: '',
    device: '',
    notes: '',
  }),
  draft = ref(initial())
const fields = ['height', 'weight', 'bodyFat', 'fatMass', 'muscle', 'skeletal', 'waist', 'rmr'],
  requiredMeasurements = ['height', 'weight'],
  labels = {
    height: 'height',
    weight: 'bodyWeight',
    bodyFat: 'bodyFat',
    fatMass: 'fatMass',
    muscle: 'muscle',
    skeletal: 'skeletal',
    waist: 'waist',
    rmr: 'measuredRmr',
  },
  history = computed(() =>
    store.data.measurements.slice().sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
  ),
  latest = computed(() => measurementAt(store.data.measurements, localDate(new Date(), store.data.settings.timeZone), store.data.settings.timeZone)),
  resting = computed(() => rmr(latest.value, store.data.profile, localDate(new Date(), store.data.settings.timeZone))),
  restingHelp = computed(() => {
    const result = restingEstimate(latest.value, store.data.profile, localDate(new Date(), store.data.settings.timeZone))
    if (resting.value !== null) return ''
    if (result.reason === 'missing') return t('rmrMissing', { fields: result.missing.map((key) => t(key)).join('、') })
    return t(result.reason === 'ageRange' ? 'rmrAgeRange' : 'rmrDateInvalid')
  })
profile.value = profileAtMeasurement(profile.value, draft.value.measuredAt)
watch(() => draft.value.measuredAt, (value) => {
  profile.value = profileAtMeasurement(profile.value, value)
}, { flush: 'sync' })
watch(() => store.data.profile, (value) => {
  profile.value = profileAtMeasurement(clone(value), draft.value.measuredAt)
}, { deep: true })
function validProfile() {
  const age = profile.value.age
  const date = draft.value.measuredAt.slice(0, 10)
  return Number.isInteger(Number(age)) && age > 0 && age <= 120 &&
    ['male', 'female'].includes(profile.value.sex) &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
}
async function saveProfile() {
  saved.value = false
  if (!Array.from(profileFields.value.querySelectorAll('input, select')).every((field) => field.reportValidity())) return
  invalid.value = !validProfile()
  if (invalid.value) return
  store.data.profile = { ...clone(profile.value), ageDate: draft.value.measuredAt.slice(0, 10) }
  try { await store.persist(); saved.value = true } catch {}
}
async function save() {
  saved.value = false
  invalid.value = false
  const d = clone(draft.value)
  if (
    !validProfile() ||
    !(d.weight >= 10 && d.weight <= 500) ||
    !(d.height >= 50 && d.height <= 260) ||
    fields.some((k) => d[k] !== '' && (!Number.isFinite(Number(d[k])) || Number(d[k]) < 0)) ||
    (d.bodyFat !== '' && d.bodyFat > 100) ||
    (profile.value.age !== null &&
      profile.value.age !== '' &&
      !(profile.value.age > 0 && profile.value.age <= 120))
  ) {
    invalid.value = true
    return
  }
  fields.forEach((k) => (d[k] = d[k] === '' ? null : Number(d[k])))
  d.measuredAt = new Date(d.measuredAt).toISOString()
  d.id ||= uid()
  const i = store.data.measurements.findIndex((m) => m.id === d.id)
  if (i < 0) store.data.measurements.push(d)
  else store.data.measurements[i] = d
  store.data.profile = { ...clone(profile.value), ageDate: draft.value.measuredAt.slice(0, 10) }
  try {
    await store.persist()
    draft.value = initial()
    saved.value = true
  } catch {}
}
function edit(m) {
  const d = clone(m)
  const dt = new Date(m.measuredAt)
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  d.measuredAt = dt.toISOString().slice(0, 16)
  fields.forEach((k) => (d[k] ??= ''))
  draft.value = d
  saved.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function remove(id) {
  if (confirm(t('confirmDelete')))
    store.data.measurements = store.data.measurements.filter((m) => m.id !== id)
}
</script>
<template>
  <div class="page-heading">
    <h1>{{ t('body') }}</h1>
  </div>
  <div class="metric-grid three">
    <article class="metric-card">
      <span class="muted">{{ t('bmi') }}</span>
      <div class="metric-number">
        {{
          latest?.height
            ? n(latest.weight / (latest.height / 100) ** 2, {
                maximumFractionDigits: 1,
              })
            : '—'
        }}
      </div>
    </article>
    <article class="metric-card">
      <span class="muted">{{ t('lean') }}</span>
      <div class="metric-number">
        {{
          latest?.bodyFat != null
            ? n(latest.weight * (1 - latest.bodyFat / 100), {
                maximumFractionDigits: 1,
              })
            : '—'
        }}<small>kg</small>
      </div>
    </article>
    <article class="metric-card">
      <span class="muted">{{ t('resting') }}</span>
      <div class="metric-number">
        {{ resting === null ? '—' : n(resting, { maximumFractionDigits: 0 }) }}<small>kcal</small>
      </div>
      <p v-if="restingHelp" class="small muted">{{ restingHelp }}</p>
    </article>
  </div>
  <form id="measurement-form" class="panel body-form" @submit.prevent="save">
    <h2>{{ t('addMeasurement') }}</h2>
    <div ref="profileFields" class="form-grid three">
      <label>
        <span>{{ t('measurementDate') }} <span class="required-marker" aria-hidden="true"></span></span>
        <input type="datetime-local" v-model="draft.measuredAt" aria-describedby="measurement-date-hint" required />
      </label>
      <label>
        <span>{{ t('age') }} <span class="required-marker" aria-hidden="true"></span></span>
        <input type="number" min="1" max="120" step="1" v-model.number="profile.age" required />
      </label>
      <label>
        <span>{{ t('sex') }} <span class="required-marker" aria-hidden="true"></span></span>
        <select v-model="profile.sex" required>
          <option value="" disabled>{{ t('chooseFormulaSex') }}</option>
          <option value="male">{{ t('male') }}</option>
          <option value="female">{{ t('female') }}</option>
        </select>
      </label>
    </div>
    <p id="measurement-date-hint" class="small muted">{{ t('measurementDateHint') }}</p>
    <button type="button" class="button" @click="saveProfile">{{ t('saveProfile') }}</button>
    <div class="form-grid three">
      <label v-for="k in fields" :key="k">
        <span>{{ t(labels[k]) }} <span v-if="requiredMeasurements.includes(k)" class="required-marker" aria-hidden="true"></span></span>
        <input
          type="number"
          :min="k === 'height' ? 50 : k === 'weight' ? 10 : 0"
          :max="k === 'height' ? 260 : k === 'weight' ? 500 : k === 'bodyFat' ? 100 : 10000"
          step="0.1"
          v-model="draft[k]"
          :required="requiredMeasurements.includes(k)"
          :placeholder="requiredMeasurements.includes(k) ? undefined : t('optional')"
        />
      </label>
    </div>
    <CalculatedBodyFields :measurement="draft" :profile="profile" :date="draft.measuredAt.slice(0, 10)" />
    <p class="small muted">{{ t('measuredRmrHint') }}</p>
    <p v-if="invalid" class="error" role="alert">{{ t('invalid') }}</p>
    <p v-if="saved" role="status">{{ t('saved') }}</p>
    <p class="small muted">{{ t('bodyLimit') }}</p>
    <button class="button primary">{{ t('save') }}</button>
  </form>
  <section class="panel spaced">
    <h2>{{ t('measurementHistory') }}</h2>
    <svg
      v-if="history.length"
      class="weight-chart"
      viewBox="0 0 640 140"
      role="img"
      :aria-label="t('bodyWeight')"
    >
      <polyline
        :points="
          history
            .slice()
            .reverse()
            .map((m, i) =>
              [
                30 + (i / Math.max(1, history.length - 1)) * 570,
                110 -
                  ((m.weight - Math.min(...history.map((m) => m.weight))) /
                    Math.max(
                      1,
                      Math.max(...history.map((m) => m.weight)) -
                        Math.min(...history.map((m) => m.weight)),
                    )) *
                    80,
              ].join(','),
            )
            .join(' ')
        "
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="3"
      />
      <circle
        v-for="(m, i) in history.slice().reverse()"
        :key="m.id"
        :cx="30 + (i / Math.max(1, history.length - 1)) * 570"
        :cy="
          110 -
          ((m.weight - Math.min(...history.map((m) => m.weight))) /
            Math.max(
              1,
              Math.max(...history.map((m) => m.weight)) - Math.min(...history.map((m) => m.weight)),
            )) *
            80
        "
        r="4"
        fill="var(--color-primary)"
      />
    </svg>
    <p v-if="!history.length" class="muted">{{ t('noData') }}</p>
    <article v-for="m in history" :key="m.id" class="history-row">
      <div>
        <b
          >{{ localDate(m.measuredAt, store.data.settings.timeZone) }} ·
          {{
            new Intl.DateTimeFormat(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: store.data.settings.timeZone,
            }).format(new Date(m.measuredAt))
          }}</b
        >
        <p>
          {{ m.weight }} kg · {{ m.height || '—' }} cm · {{ t('bodyFat') }} {{ m.bodyFat ?? '—' }}%
        </p>
        <p class="small muted">
          {{
            fields
              .slice(3)
              .map((k) => t(labels[k]) + ': ' + (m[k] ?? '—'))
              .join(' · ')
          }}
        </p>
      </div>
      <button @click="edit(m)" :aria-label="t('edit')">
        <Pencil :size="18" /></button
      ><button @click="remove(m.id)" :aria-label="t('delete')">
        <Trash2 :size="18" />
      </button>
    </article>
  </section>
</template>


<style scoped>
.required-marker::before {
  content: '*';
  color: var(--color-danger);
  font-weight: 700;
}
</style>
