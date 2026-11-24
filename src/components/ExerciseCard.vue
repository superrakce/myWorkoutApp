<script setup>
import { useI18n } from 'vue-i18n'
import { Heart, Plus, Pencil, Trash2 } from 'lucide-vue-next'
defineProps({ exercise: { type: Object, required: true }, favorite: Boolean })
defineEmits(['details', 'favorite', 'add', 'edit', 'delete'])
const { t, locale } = useI18n()
</script>

<template>
  <article class="exercise-card compact-card">
    <div class="compact-card-main">
      <div class="compact-card-details">
        <h3>
          <button class="exercise-name" @click="$emit('details')">{{ exercise.name[locale] }}</button>
        </h3>
        <div class="compact-card-meta">
          <span>{{ t('labels.' + exercise.primary[0]) }} · {{ t(exercise.difficulty) }}</span>
          <span v-if="exercise.equipment.length">
            {{ exercise.equipment.map((e) => t('labels.' + e)).join(' · ') }}
          </span>
        </div>
      </div>
      <button
        class="card-icon-button card-primary-action"
        :aria-label="t('addToPlan')"
        :title="t('addToPlan')"
        @click="$emit('add')"
      ><Plus :size="19" /></button>
    </div>
    <div class="compact-card-actions">
      <button
        class="card-icon-button"
        :class="{ active: favorite }"
        :aria-label="t('favorite')"
        :aria-pressed="favorite"
        :title="t('favorite')"
        @click="$emit('favorite')"
      ><Heart :size="17" :fill="favorite ? 'currentColor' : 'none'" /></button>
      <button class="card-icon-button" :aria-label="t('edit')" :title="t('edit')" @click="$emit('edit')">
        <Pencil :size="16" />
      </button>
      <button class="card-icon-button" :aria-label="t('delete')" :title="t('delete')" @click="$emit('delete')">
        <Trash2 :size="16" />
      </button>
    </div>
  </article>
</template>
