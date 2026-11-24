<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Flame, Utensils, Activity, Plus, Play, CalendarDays, Dumbbell } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { templates } from '../data/catalog.js'
import { localDate, dailyStats, distribution, rangeSets } from '../services/domain.js'
import TrainingRadar from '../components/TrainingRadar.vue'
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
</script>
<template>
  <div class="page-heading dashboard-heading">
    <div>
      <p class="eyebrow">{{ date }}</p>
      <h1>{{ t('overview') }}</h1>
    </div>
    <div class="dashboard-actions">
      <RouterLink :to="{ path: '/plans', query: { new: '1' } }" class="button primary">
        <Plus :size="17" />{{ t('newPlan') }}
      </RouterLink>
      <RouterLink :to="{ path: '/nutrition', query: { new: '1' } }" class="button soft">
        <Utensils :size="17" />{{ t('logMeal') }}
      </RouterLink>
      <RouterLink :to="{ path: '/body', hash: '#measurement-form' }" class="button soft">
        <Activity :size="17" />{{ t('addMeasurement') }}
      </RouterLink>
      <button class="button accent" @click="start(store.data.plans[0] || templates[0])">
        <Play :size="16" fill="currentColor" />{{ t('start') }}
      </button>
    </div>
  </div>
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow"><span class="yellow-dot" />{{ t('weekFocus') }}</p>
      <h2>{{ t('welcome') }}</h2>
      <p>{{ t('welcomeSub') }}</p>
      <RouterLink to="/exercises" class="hero-link">{{ t('explore') }}</RouterLink>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="hero-ring ring1" />
      <div class="hero-ring ring2" />
      <svg viewBox="0 0 330 280">
        <g transform="rotate(-32 165 140)">
          <rect x="80" y="124" width="170" height="25" rx="8" fill="var(--palette-ash)" />
          <rect x="75" y="79" width="35" height="115" rx="10" fill="var(--color-accent)" />
          <rect x="51" y="96" width="26" height="81" rx="8" fill="var(--color-accent-hover)" />
          <rect x="220" y="79" width="35" height="115" rx="10" fill="var(--color-accent)" />
          <rect x="255" y="96" width="26" height="81" rx="8" fill="var(--color-accent-hover)" />
          <path d="M86 90V180M231 90V180" stroke="var(--color-on-action)" opacity=".3" stroke-width="4" />
        </g></svg
      ><span class="art-caption">{{ t('artCaption') }}</span>
    </div>
  </section>
  <div class="dashboard-columns">
    <section class="dashboard-statistics">
      <div class="section-heading overview-title">
        <h2>{{ t('yourDay') }}</h2>
        <span class="muted small">{{ t('provisional') }}</span>
      </div>
      <div class="metric-grid dashboard-metrics">
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
    </section>
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


<style scoped>
.dashboard-heading {
  flex-wrap: wrap;
  gap: 12px;
}
.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dashboard-actions svg {
  flex: none;
}
.dashboard-columns {
  margin-top: 24px;
}
.dashboard-metrics {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 0;
}
.overview-title {
  margin-top: 0;
}
@media (max-width: 600px) {
  .dashboard-actions {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-actions .button {
    font-size: 13px;
    padding-inline: 8px;
  }
}
</style>
