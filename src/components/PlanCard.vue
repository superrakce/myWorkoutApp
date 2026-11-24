<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Clock3 } from 'lucide-vue-next'
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
  <article class="plan-card compact-card">
    <div class="compact-card-main">
      <div class="compact-card-details">
        <h3>{{ label(plan.name) }}</h3>
        <div class="compact-card-meta">
          <span class="plan-mode" :class="{ interval: plan.tabata }">
            {{ t(plan.tabata ? 'tabata' : plan.mode === 'straight' ? 'legacyPlanOrder' : 'circuit') }}
          </span>
          <span>{{ t('exCount', { count: plan.items.length }) }} · {{ t('countSets', { count: plan.sets }, plan.sets) }}</span>
          <span class="plan-time">
            <Clock3 :size="14" />{{ seconds === null ? t('timeUnknown') : t('shortMinutes', { count: Math.ceil(seconds / 60) }) }}
          </span>
        </div>
      </div>
      <button
        class="card-icon-button card-primary-action"
        :aria-label="t(plan.tabata ? 'tabataStart' : 'start')"
        :title="t(plan.tabata ? 'tabataStart' : 'start')"
        @click="$emit('start')"
      >
        <Play :size="17" fill="currentColor" />
      </button>
    </div>
    <div class="compact-card-actions">
      <button v-if="isTemplate" class="text-button" @click="$emit('use')">
        {{ t('useTemplate') }}
      </button>
      <button v-else class="text-button" @click="$emit('edit')">{{ t('edit') }}</button>
      <slot name="actions" />
    </div>
  </article>
</template>
