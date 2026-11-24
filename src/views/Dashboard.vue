<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Flame, Utensils, Activity, Plus, Play, CalendarDays } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { templates } from '../data/catalog.js'
import { localDate, dailyStats, distribution, rangeSets } from '../services/domain.js'
import { unlockWorkoutBell } from '../services/workoutBell.js'
import TrainingRadar from '../components/TrainingRadar.vue'
const store = useAppStore(),
  { t, n } = useI18n(),
  router = useRouter()
const today = computed(() => localDate(new Date(), store.data.settings.timeZone)),
  stats = computed(() => dailyStats(store.data, today.value)),
  radar = computed(() =>
    distribution(
      rangeSets(store.data.sessions, today.value, today.value, store.data.settings.timeZone),
    ),
  )
function start(plan) {
  unlockWorkoutBell()
  if (store.data.active) {
    router.push('/player')
    return
  }
  router.push('/player?plan=' + plan.id)
}
</script>
<template>
  <div class="page-heading dashboard-heading">
    <h1>{{ t('overview') }}</h1>
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
