<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parts } from '../data/catalog.js'
const model = defineModel({ type: String, default: '' }),
  rear = ref(false),
  { t } = useI18n()
const select = (p) => (model.value = model.value === p ? '' : p)
</script>
<template>
  <div class="body-selector">
    <div class="segmented">
      <button :class="{ active: !rear }" @click="rear = false">
        {{ t('front') }}</button><button :class="{ active: rear }" @click="rear = true">
        {{ t('backView') }}
      </button>
    </div>
    <svg class="body-map" viewBox="0 0 180 300" role="group" :aria-label="t('allParts')">
      <g fill="var(--color-pressed)" stroke="var(--color-surface)" stroke-width="2">
        <circle cx="90" cy="27" r="18" />
        <path d="M78 46H102L108 64H72Z" />
        <path
          v-for="(path, p) in {
            shoulders: 'M73 60L55 65L42 90L59 98L70 80H110L121 98L138 90L125 65L107 60Z',
            arms: 'M42 91L32 134L22 166L35 172L50 142L59 99ZM138 91L148 134L158 166L145 172L130 142L121 99Z',
            chest: 'M69 76H111L117 108L90 116L63 108Z',
            core: 'M64 110L90 118L116 110L110 155L90 167L70 155Z',
            lower_body:
              'M70 158L90 170L110 158L119 206L113 253L116 280L99 282L94 251L90 211L86 251L81 282L64 280L67 253L61 206Z',
          }"
          :key="p"
          :d="path"
          :fill="model === (rear && p === 'chest' ? 'back' : p) ? 'var(--color-accent)' : undefined"
          tabindex="0"
          role="button"
          :aria-label="t('labels.' + (rear && p === 'chest' ? 'back' : p))"
          :aria-pressed="model === (rear && p === 'chest' ? 'back' : p)"
          @click="select(rear && p === 'chest' ? 'back' : p)"
          @keydown.enter="select(rear && p === 'chest' ? 'back' : p)"
          @keydown.space.prevent="select(rear && p === 'chest' ? 'back' : p)"
        />
      </g></svg
    ><label
      >{{ t('allParts')
      }}<select v-model="model">
        <option value="">{{ t('allParts') }}</option>
        <option v-for="p in parts" :key="p" :value="p">
          {{ t('labels.' + p) }}
        </option>
      </select></label
    >
  </div>
</template>
