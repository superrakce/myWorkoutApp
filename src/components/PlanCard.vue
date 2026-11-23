<script setup>
import { useI18n } from 'vue-i18n'
import { Play, Clock3, Dumbbell, Ellipsis } from 'lucide-vue-next'
import { duration } from '../services/domain.js'
defineProps({ plan: { type: Object, required: true }, isTemplate: Boolean })
defineEmits(['start', 'edit', 'use'])
const { t, locale } = useI18n()
const label = (v) => (typeof v === 'object' ? v[locale.value] : v)
</script>
<template>
  <article class="plan-card">
    <div class="plan-visual" :class="{ interval: plan.id === 'tabata' }">
      <div class="orb orb-one" />
      <div class="orb orb-two" />
      <Dumbbell :size="70" :stroke-width="1" /><span class="visual-label">{{ t(plan.mode) }}</span
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
            duration(plan) === null
              ? t('timeUnknown')
              : t('shortMinutes', { count: Math.ceil(duration(plan) / 60) })
          }}</span
        >
      </div>
      <div class="card-bottom">
        <button v-if="isTemplate" class="text-button" @click="$emit('use')">
          ＋ {{ t('useTemplate') }}</button
        ><button v-else class="text-button" @click="$emit('edit')">
          {{ t('edit') }}</button
        ><button class="play-button" :aria-label="t('start')" @click="$emit('start')">
          <Play :size="18" fill="currentColor" />
        </button>
      </div>
    </div>
  </article>
</template>
