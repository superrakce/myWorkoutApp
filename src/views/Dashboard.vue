<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Flame, Utensils, Activity, Plus, Play, CalendarDays, Dumbbell } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { templates } from '../data/catalog.js'
import { localDate, dailyStats, distribution, rangeSets, clone } from '../services/domain.js'
import TrainingRadar from '../components/TrainingRadar.vue'
import PlanCard from '../components/PlanCard.vue'
const store = useAppStore(),
  { t, locale, n } = useI18n(),
  router = useRouter()
const today = computed(() => localDate(new Date(), store.data.settings.timeZone)),
  stats = computed(() => dailyStats(store.data, today.value)),
  radar = computed(() =>
    distribution(
      rangeSets(store.data.sessions, today.value, today.value, store.data.settings.timeZone),
    ),
  )
const date = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: store.data.settings.timeZone,
  }).format(new Date()),
)
function start(plan) {
  if (store.data.active) {
    router.push('/player')
    return
  }
  router.push('/player?plan=' + plan.id)
}
function useTemplate(plan) {
  const p = clone(plan)
  p.name = p.name[locale.value]
  p.description = p.description[locale.value]
  p.id = null
  const id = store.savePlan(p)
  router.push('/plans?edit=' + id)
}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ date }}</p>
      <h1>{{ t('overview') }}</h1>
    </div>
    <RouterLink to="/plans" class="button primary"
      ><Plus :size="18" />{{ t('newPlan') }}</RouterLink
    >
  </div>
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow"><span class="yellow-dot" />{{ t('weekFocus') }}</p>
      <h2>{{ t('welcome') }}</h2>
      <p>{{ t('welcomeSub') }}</p>
      <div class="hero-actions">
        <button class="button accent" @click="start(store.data.plans[0] || templates[0])">
          <Play :size="16" fill="currentColor" />{{ t('start') }}</button
        ><RouterLink to="/exercises" class="hero-link">{{ t('explore') }}</RouterLink>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="hero-ring ring1" />
      <div class="hero-ring ring2" />
      <svg viewBox="0 0 330 280">
        <g transform="rotate(-32 165 140)">
          <rect x="80" y="124" width="170" height="25" rx="8" fill="#b2c7e6" />
          <rect x="75" y="79" width="35" height="115" rx="10" fill="#facc15" />
          <rect x="51" y="96" width="26" height="81" rx="8" fill="#e5b814" />
          <rect x="220" y="79" width="35" height="115" rx="10" fill="#facc15" />
          <rect x="255" y="96" width="26" height="81" rx="8" fill="#e5b814" />
          <path d="M86 90V180M231 90V180" stroke="#fff" opacity=".3" stroke-width="4" />
        </g></svg
      ><span class="art-caption">{{ t('artCaption') }}</span>
    </div>
  </section>
  <div class="section-heading overview-title">
    <h2>{{ t('yourDay') }}</h2>
    <span class="muted small">{{ t('provisional') }}</span>
  </div>
  <div class="metric-grid">
    <article
      v-for="(m, i) in [
        ['intake', stats.consumed, Utensils],
        ['resting', stats.resting, Flame],
        ['net', stats.net, Activity],
        ['balance', stats.balance, CalendarDays],
      ]"
      :key="m[0]"
      class="metric-card"
    >
      <div class="metric-label">
        <span>{{ t(m[0]) }}</span><component :is="m[2]" :size="18" />
      </div>
      <div class="metric-number" :class="{ missing: m[1] === null }">
        {{ m[1] === null ? '—' : n(m[1], { maximumFractionDigits: 0 })
        }}<small v-if="m[1] !== null">kcal</small>
      </div>
      <p>
        {{
          m[1] === null
            ? t('insufficient')
            : i === 0
              ? t(store.data.days[today]?.foodComplete ? 'confirmed' : 'unconfirmed')
              : t('provisional')
        }}
      </p>
    </article>
  </div>
  <div class="dashboard-columns">
    <div>
      <div class="section-heading">
        <h2>{{ t('training') }}</h2>
        <RouterLink to="/plans">{{ t('viewAll') }}</RouterLink>
      </div>
      <div class="plan-grid dashboard-plans">
        <PlanCard
          v-for="p in store.data.plans.length
            ? store.data.plans.slice(0, 2)
            : templates.slice(0, 2)"
          :key="p.id"
          :plan="p"
          :is-template="!store.data.plans.length"
          @start="start(p)"
          @edit="router.push('/plans?edit=' + p.id)"
          @use="useTemplate(p)"
        />
      </div>
      <div class="quick-panel">
        <div>
          <p class="eyebrow">{{ t('quick') }}</p>
          <h3>{{ t('weekFocusSub') }}</h3>
        </div>
        <div class="quick-buttons">
          <RouterLink to="/nutrition"
            ><Utensils :size="18" />{{ t('logMeal') }}<Plus :size="16" /></RouterLink
          ><RouterLink to="/body"
            ><Activity :size="18" />{{ t('addMeasurement') }}<Plus :size="16"
          /></RouterLink>
        </div>
      </div>
    </div>
    <div class="panel">
      <TrainingRadar :data="radar" actual />
      <div class="radar-footnote">
        {{ t('today') }} · {{ t('completeSets') }} <b>{{ radar.total }}</b>
      </div>
    </div>
  </div>
  <section class="panel recent-section">
    <div class="section-heading">
      <h2>{{ t('history') }}</h2>
      <RouterLink to="/history">{{ t('viewAll') }}</RouterLink>
    </div>
    <div v-if="!store.data.sessions.length" class="empty-inline">
      <div class="empty-icon"><Dumbbell :size="26" /></div>
      <div>
        <h3>{{ t('emptyHistory') }}</h3>
        <p>{{ t('emptyHint') }}</p>
      </div>
      <RouterLink to="/plans" class="button soft">{{ t('start') }}</RouterLink>
    </div>
    <RouterLink
      v-for="s in store.data.sessions.slice(-3).reverse()"
      :key="s.id"
      to="/history"
      class="history-preview"
      ><b>{{ s.snapshot.name }}</b
      ><span>{{ localDate(s.startedAt) }} · {{ t(s.status) }}</span></RouterLink
    >
  </section>
</template>
