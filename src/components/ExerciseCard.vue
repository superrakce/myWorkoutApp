<script setup>
import { useI18n } from 'vue-i18n'
import { Heart, Plus } from 'lucide-vue-next'
import ExerciseArt from './ExerciseArt.vue'
defineProps({ exercise: { type: Object, required: true }, favorite: Boolean })
defineEmits(['details', 'favorite', 'add', 'edit', 'delete'])
const { t, locale } = useI18n()
</script>
<template>
  <article class="exercise-card">
    <button class="art-button" @click="$emit('details')" :aria-label="exercise.name[locale]">
      <ExerciseArt :part="exercise.primary[0]" /></button
    ><button
      class="favorite-button"
      :class="{ active: favorite }"
      :aria-label="t('favorite')"
      :aria-pressed="favorite"
      @click="$emit('favorite')"
    >
      <Heart :size="18" :fill="favorite ? 'currentColor' : 'none'" />
    </button>
    <div class="exercise-card-copy">
      <span class="eyebrow">{{ t(exercise.type) }} · {{ t(exercise.difficulty) }}</span
      ><button class="exercise-name" @click="$emit('details')">
        {{ exercise.name[locale] }}
      </button>
      <p>{{ exercise.equipment.map((e) => t('labels.' + e)).join(' · ') }}</p>
      <div class="card-bottom">
        <span class="muscle-tag">{{ t('labels.' + exercise.primary[0]) }}</span><button
          class="add-icon"
          @click="$emit('add')"
          :aria-label="t('addToPlan')"
        >
          <Plus :size="20" />
        </button>
      </div>
      <div class="form-actions">
        <button class="text-button" @click="$emit('edit')">{{ t('edit') }}</button>
        <button class="text-button" @click="$emit('delete')">{{ t('delete') }}</button>
      </div>
    </div>
  </article>
</template>
