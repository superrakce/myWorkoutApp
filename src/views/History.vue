<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import {
  localDate,
  rangeSets,
  distribution,
  clone,
  uid,
  noonInZone,
  datesBetween,
  minutesOnDate,
  dailyStats,
} from '../services/domain.js'
import { exercises } from '../data/catalog.js'
import TrainingRadar from '../components/TrainingRadar.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import SessionSummary from '../components/SessionSummary.vue'
const store = useAppStore(),
  { t, locale, n } = useI18n(),
  today = localDate(new Date(), store.data.settings.timeZone),
  end = ref(today),
  start = ref(
    new Date(new Date(today + 'T00:00:00Z').getTime() - 6 * 86400000).toISOString().slice(0, 10),
  ),
  selected = ref(null),
  manual = ref(false),
  exerciseId = ref(exercises[0].id),
  date = ref(today),
  count = ref(3),
  value = ref(12)
const logs = computed(() =>
    rangeSets(store.data.sessions, start.value, end.value, store.data.settings.timeZone),
  ),
  radar = computed(() => distribution(logs.value)),
  list = computed(() =>
    store.data.sessions
      .filter((s) => {
        const d = localDate(s.startedAt, store.data.settings.timeZone)
        return (
          (d >= start.value && d <= end.value) ||
          s.logs.some(
            (l) =>
              l.completedAt &&
              localDate(l.completedAt, store.data.settings.timeZone) >= start.value &&
              localDate(l.completedAt, store.data.settings.timeZone) <= end.value,
          )
        )
      })
      .slice()
      .reverse(),
  ),
  started = computed(() =>
    list.value.filter((s) => {
      const d = localDate(s.startedAt, store.data.settings.timeZone)
      return d >= start.value && d <= end.value
    }),
  ),
  days = computed(
    () =>
      new Set(
        logs.value
          .filter((l) => l.status === 'completed')
          .map((l) => localDate(l.completedAt, store.data.settings.timeZone)),
      ).size,
  )
const energySummary = computed(() => {
  const dates = datesBetween(start.value, end.value)
  const sessions = store.data.sessions.filter((s) =>
    dates.some((d) => minutesOnDate(s, d, store.data.settings.timeZone) !== null),
  )
  const minutes = sessions.reduce(
    (sum, s) =>
      sum + dates.reduce((v, d) => v + (minutesOnDate(s, d, store.data.settings.timeZone) || 0), 0),
    0,
  )
  const daily = dates.map((d) => dailyStats(store.data, d))
  const unknown = sessions.filter((s) => !s.met || !s.minutes).length
  const incomplete = daily.some(
    (s, i) =>
      s.net === null &&
      sessions.some(
        (session) => minutesOnDate(session, dates[i], store.data.settings.timeZone) !== null,
      ),
  )
  return {
    minutes,
    unknown,
    net: sessions.length && !incomplete ? daily.reduce((sum, s) => sum + (s.net || 0), 0) : null,
  }
})
function remove(id) {
  if (confirm(t('confirmDelete')))
    store.data.sessions = store.data.sessions.filter((s) => s.id !== id)
}
async function save(d) {
  if (d.status !== 'aborted')
    d.status = d.logs.every((l) => l.status === 'completed') ? 'completed' : 'partial'
  const i = store.data.sessions.findIndex((s) => s.id === d.id)
  if (i < 0) store.data.sessions.push(d)
  else store.data.sessions[i] = d
  try {
    await store.persist()
    selected.value = null
  } catch {}
}
function addManual() {
  const e = exercises.find((x) => x.id === exerciseId.value),
    at = noonInZone(date.value, store.data.settings.timeZone)
  selected.value = {
    id: uid(),
    snapshot: { name: e.name[locale.value], items: [] },
    startedAt: at,
    endedAt: at,
    status: 'completed',
    source: 'manual',
    minutes: 0,
    met: 0,
    notes: '',
    logs: Array.from({ length: count.value }, (_, i) => ({
      id: uid(),
      exerciseId: e.id,
      exercise: clone(e),
      set: i + 1,
      mode: e.mode,
      target: value.value,
      actual: value.value,
      weight: 0,
      status: 'completed',
      completedAt: at,
    })),
  }
  manual.value = false
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ t('historyEyebrow') }}</p>
      <h1>{{ t('history') }}</h1>
    </div>
    <button class="button primary" @click="manual = true">
      <Plus :size="18" />{{ t('manual') }}
    </button>
  </div>
  <template v-if="!selected"
    ><DateRangeFilter v-model:start="start" v-model:end="end" :today="today" />
    <div class="metric-grid three">
      <article
        class="metric-card"
        v-for="m in [
          ['sessions', started.length],
          ['days', days],
          ['completeSets', logs.filter((l) => l.status === 'completed').length],
        ]"
        :key="m[0]"
      >
        <span class="muted">{{ t(m[0]) }}</span>
        <div class="metric-number">{{ m[1] }}</div>
      </article>
    </div>
    <section class="panel range-energy">
      <h3>{{ t('sessionMetrics') }}</h3>
      <p>
        <b>{{ n(energySummary.minutes, { maximumFractionDigits: 1 }) }} {{ t('minutes') }}</b> ·
        {{ t('net') }}
        <b>{{
          energySummary.net === null
            ? '—'
            : n(energySummary.net, { maximumFractionDigits: 0 }) + ' kcal'
        }}</b>
        · {{ t('unestimated') }} {{ energySummary.unknown }}
      </p>
    </section>
    <div class="history-layout">
      <section class="panel">
        <h2>{{ t('history') }}</h2>
        <p class="small muted">{{ t('rangeHint') }}</p>
        <div v-if="!list.length" class="empty-state">
          <h3>{{ t('emptyHistory') }}</h3>
          <p>{{ t('emptyHint') }}</p>
        </div>
        <article v-for="s in list" :key="s.id" class="history-row">
          <button class="history-open" @click="selected = clone(s)">
            <b>{{ s.snapshot.name }}</b><span
              >{{ localDate(s.startedAt, store.data.settings.timeZone) }} · {{ t(s.status) }} ·
              {{ t(s.source === 'manual' ? 'manualSource' : 'playerSource') }}</span
            ><span
              >{{ s.logs.filter((l) => l.status === 'completed').length }} {{ t('sets') }} ·
              {{ n(s.minutes || 0, { maximumFractionDigits: 1 }) }}
              {{ t('minutes') }}</span
            ></button
          ><button @click="remove(s.id)" :aria-label="t('delete')">
            <Trash2 :size="18" />
          </button>
        </article>
      </section>
      <aside class="panel">
        <TrainingRadar :data="radar" actual />
      </aside></div></template
  ><template v-else
    ><button class="text-button" @click="selected = null">
      {{ t('back') }}</button
    ><SessionSummary :key="selected.id" :session="selected" @save="save"
  /></template>
  <div v-if="manual" class="modal-overlay" @click.self="manual = false">
    <form
      class="modal compact"
      role="dialog"
      aria-modal="true"
      :aria-label="t('manual')"
      @submit.prevent="addManual"
    >
      <h2>{{ t('manual') }}</h2>
      <label>{{ t('date') }}<input type="date" v-model="date" required /></label
      ><label
        >{{ t('exercises')
        }}<select v-model="exerciseId">
          <option v-for="e in exercises" :key="e.id" :value="e.id">
            {{ e.name[locale] }}
          </option>
        </select></label
      ><label
        >{{ t('sets')
        }}<input type="number" min="1" max="100" v-model.number="count" required /></label
      ><label
        >{{ t('actualValue') }}<input type="number" min="1" v-model.number="value" required
      /></label>
      <div class="form-actions">
        <button type="button" @click="manual = false">{{ t('cancel') }}</button><button
          class="button primary"
        >
          {{ t('next') }}
        </button>
      </div>
    </form>
  </div>
</template>
