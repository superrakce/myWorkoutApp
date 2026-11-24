<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Copy, Pencil } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { localDate, uid, clone, dailyStats } from '../services/domain.js'
import NutritionEntryForm from '../components/NutritionEntryForm.vue'
import EnergyStats from '../components/EnergyStats.vue'
const store = useAppStore(),
  { t, n } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  date = ref(localDate(new Date(), store.data.settings.timeZone)),
  form = ref(route.query.new === '1'),
  editing = ref(null)
const meals = computed(() => store.data.meals.filter((m) => m.date === date.value)),
  stats = computed(() => dailyStats(store.data, date.value)),
  status = computed(() => store.data.days[date.value] || {})
function update(k, v) {
  store.data.days[date.value] = { ...status.value, [k]: v }
  if (k === 'noExercise' && v) store.data.days[date.value].exerciseComplete = true
}
function openEntry(entry=null){editing.value=entry;form.value=true}
onMounted(() => { if (route.query.new === '1') router.replace('/nutrition') })
async function save(m) {
  const i = store.data.meals.findIndex((x) => x.id === m.id)
  if (i < 0) store.data.meals.push(m)
  else store.data.meals[i] = m
  try {
    await store.persist()
    form.value = false
    editing.value = null
  } catch {}
}
function remove(id) {
  if (confirm(t('confirmDelete'))) store.data.meals = store.data.meals.filter((m) => m.id !== id)
}
function copy(meal) {
  meals.value
    .filter((m) => m.meal === meal)
    .forEach((m) => store.data.meals.push({ ...clone(m), id: uid() }))
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ t('nutritionEyebrow') }}</p>
      <h1>{{ t('nutrition') }}</h1>
    </div>
    <button
      class="button primary"
      @click="openEntry()"
    >
      <Plus :size="18" />{{ t('logMeal') }}
    </button>
  </div>
  <label class="date-input">{{ t('date') }}<input type="date" v-model="date" required /></label>
  <div class="metric-grid three">
    <article class="metric-card">
      <span class="muted">{{ t('intake') }}</span>
      <div class="metric-number">
        {{ n(stats.consumed, { maximumFractionDigits: 0 }) }}<small>kcal</small>
      </div>
    </article>
    <article class="metric-card">
      <span class="muted">{{ t('protein') }}</span>
      <div class="metric-number">
        {{ stats.protein === null ? '—' : n(stats.protein, { maximumFractionDigits: 1 })
        }}<small>g</small>
      </div>
    </article>
    <article class="metric-card">
      <span class="muted">{{ t('balance') }}</span>
      <div class="metric-number">
        {{ stats.balance === null ? '—' : n(stats.balance, { maximumFractionDigits: 0 })
        }}<small>kcal</small>
      </div>
    </article>
  </div>
  <div class="meal-grid">
    <section
      v-for="meal in ['breakfast', 'lunch', 'dinner', 'snack']"
      :key="meal"
      class="panel meal-panel"
    >
      <div class="section-heading">
        <h3>{{ t(meal) }}</h3>
        <button
          :aria-label="t('copyMeal')"
          @click="copy(meal)"
          :disabled="!meals.some((m) => m.meal === meal)"
        >
          <Copy :size="17" />
        </button>
      </div>
      <p v-if="!meals.some((m) => m.meal === meal)" class="muted">
        {{ t('noMeals') }}
      </p>
      <article v-for="m in meals.filter((m) => m.meal === meal)" :key="m.id" class="meal-row">
        <div>
          <b>{{ m.name }}</b>
          <p>{{ n(m.kcal, { maximumFractionDigits: 0 }) }} kcal</p>
        </div>
        <button
          :aria-label="t('edit')"
          @click="openEntry(m)"
        >
          <Pencil :size="16" /></button
        ><button :aria-label="t('delete')" @click="remove(m.id)">
          <Trash2 :size="16" />
        </button>
      </article>
    </section>
  </div>
  <section class="panel completeness">
    <label v-for="k in ['foodComplete', 'exerciseComplete', 'noExercise']" :key="k" class="checkbox"
      ><input type="checkbox" :checked="status[k]" @change="update(k, $event.target.checked)" />{{
        t(k)
      }}</label
    >
  </section>
  <p class="muted small">{{ t('foodSource') }}</p>
  <EnergyStats />
  <div v-if="form" class="modal-overlay" @click.self="form = false">
    <section class="modal compact" role="dialog" aria-modal="true" :aria-label="t('logMeal')">
      <NutritionEntryForm
        :key="editing?.id || 'new'"
        :date="date"
        :entry="editing"
        @save="save"
        @cancel="form = false"
      />
    </section>
  </div>
</template>
