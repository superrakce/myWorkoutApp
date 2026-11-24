<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Clock3, Dumbbell } from 'lucide-vue-next'
import { duration } from '../services/domain.js'
const props = defineProps({ plan: { type: Object, required: true }, isTemplate: Boolean })
defineEmits(['start', 'edit', 'use'])
const { t, locale } = useI18n()
const label = (v) => (typeof v === 'object' ? v[locale.value] : v)
const seconds = computed(() => {
  const total = duration(props.plan)
  return total === null ? null : total - (props.plan.tabata ? props.plan.prepare : 0)
})
</script>
<template>
  <article class="plan-card">
    <div class="plan-visual" :class="{ interval: plan.tabata }">
      <div class="orb orb-one" />
      <div class="orb orb-two" />
      <Dumbbell :size="70" :stroke-width="1" /><span class="visual-label">{{ t(plan.tabata ? 'tabata' : plan.mode) }}</span
      ><span class="visual-number">{{ String(plan.items.length).padStart(2, '0') }}</span>
    </div>
    <div class="plan-card-content">
      <span class="eyebrow">{{ t(isTemplate ? 'template' : 'plans') }}</span>
      <h3>{{ label(plan.name) }}</h3>
      <p class="muted">{{ label(plan.description) }}</p>
      <div class="plan-meta">
        <span
          ><Dumbbell :size="15" />{{ t('exCount', { count: plan.items.length }) }} ·
          {{ t('countSets', { count: plan.sets }, plan.sets) }}</span
        ><span
          ><Clock3 :size="15" />{{
            seconds === null
              ? t('timeUnknown')
              : t('shortMinutes', { count: Math.ceil(seconds / 60) })
          }}</span
        >
      </div>
      <div class="card-bottom">
        <button v-if="isTemplate" class="text-button" @click="$emit('use')">
          ＋ {{ t('useTemplate') }}</button
        ><button v-else class="text-button" @click="$emit('edit')">
          {{ t('edit') }}</button
        ><button
          :class="plan.tabata ? 'button primary' : 'play-button'"
          :aria-label="t(plan.tabata ? 'tabataStart' : 'start')"
          @click="$emit('start')"
        >
          <Play :size="18" fill="currentColor" />{{ plan.tabata ? t('tabataStart') : '' }}
        </button>
      </div>
    </div>
  </article>
</template>
