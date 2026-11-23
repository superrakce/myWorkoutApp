<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parts, equipment } from '../data/catalog.js'
import { clone, uid } from '../services/domain.js'
import { validateExercise } from '../services/exerciseLibrary.js'
const props = defineProps({ exercise: { type: Object, required: true }, busy: Boolean, error: String })
const emit = defineEmits(['save', 'cancel'])
const { t } = useI18n()
const draft = ref(props.exercise.id ? clone(props.exercise) : {
  id: 'custom-' + uid(), name: { en: '', 'zh-TW': '' }, aliases: [], type: 'strength',
  difficulty: 'beginner', mode: 'reps', primary: ['core'], secondary: [], equipment: ['bodyweight'],
  requiredEquipment: ['bodyweight'], joints: [], steps: { en: [], 'zh-TW': [] },
  media: { author: 'FORM', source: 'original SVG placeholder', license: 'project-owned', version: 1, reviewed: false },
})
const aliases = ref(draft.value.aliases.join(', '))
const stepsEn = ref(draft.value.steps.en.join('\n'))
const stepsZh = ref(draft.value.steps['zh-TW'].join('\n'))
const invalid = ref(false)
function save() {
  const value = clone(draft.value)
  value.aliases = aliases.value.split(',').map(s => s.trim()).filter(Boolean)
  const lines = s => s.split('\n').map(line => line.trim()).filter(Boolean)
  value.steps = { en: lines(stepsEn.value), 'zh-TW': lines(stepsZh.value) }
  value.requiredEquipment = [...value.equipment]
  value.deleted = false
  invalid.value = !validateExercise(value)
  if (!invalid.value) emit('save', value)
}
</script>
<template>
  <div class="modal-overlay">
    <form class="modal" role="dialog" aria-modal="true" :aria-label="t('exerciseEditor')" @submit.prevent="save">
      <h2>{{ exercise.id ? t('editExercise') : t('newExercise') }}</h2>
      <p class="small muted">{{ t('exerciseEditHint') }}</p>
      <div class="form-grid">
        <label>{{ t('exerciseNameEn') }}<input v-model.trim="draft.name.en" required maxlength="120" /></label>
        <label>{{ t('exerciseNameZh') }}<input v-model.trim="draft.name['zh-TW']" required maxlength="120" /></label>
        <label>{{ t('type') }}<select v-model="draft.type"><option v-for="key in ['strength','cardio','mobility','recovery']" :key="key" :value="key">{{ t(key) }}</option></select></label>
        <label>{{ t('difficulty') }}<select v-model="draft.difficulty"><option v-for="key in ['beginner','intermediate','advanced']" :key="key" :value="key">{{ t(key) }}</option></select></label>
        <label>{{ t('mode') }}<select v-model="draft.mode"><option value="reps">{{ t('reps') }}</option><option value="time">{{ t('seconds') }}</option></select></label>
        <label>{{ t('exerciseAliases') }}<input v-model="aliases" maxlength="2000" /></label>
      </div>
      <fieldset><legend>{{ t('primary') }} *</legend><div class="exercise-options">
        <label v-for="part in parts" :key="part" class="checkbox"><input type="checkbox" :value="part" v-model="draft.primary" />{{ t('labels.' + part) }}</label>
      </div></fieldset>
      <fieldset><legend>{{ t('secondary') }}</legend><div class="exercise-options">
        <label v-for="part in parts" :key="part" class="checkbox"><input type="checkbox" :value="part" v-model="draft.secondary" />{{ t('labels.' + part) }}</label>
      </div></fieldset>
      <fieldset><legend>{{ t('equipment') }}</legend><p class="small muted">{{ t('exerciseEquipmentHint') }}</p><div class="exercise-options">
        <label v-for="key in equipment" :key="key" class="checkbox"><input type="checkbox" :value="key" v-model="draft.equipment" />{{ t('labels.' + key) }}</label>
      </div></fieldset>
      <div class="form-grid">
        <label>{{ t('exerciseStepsEn') }}<textarea v-model="stepsEn" maxlength="10000" rows="4" /></label>
        <label>{{ t('exerciseStepsZh') }}<textarea v-model="stepsZh" maxlength="10000" rows="4" /></label>
      </div>
      <p class="small muted">{{ t('placeholder') }}</p>
      <p v-if="invalid" class="error" role="alert">{{ t('invalidExercise') }}</p>
      <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
      <div class="form-actions"><button type="button" :disabled="busy" @click="emit('cancel')">{{ t('cancel') }}</button><button class="button primary" :disabled="busy">{{ t('save') }}</button></div>
    </form>
  </div>
</template>
<style scoped>
.exercise-options { display: grid; grid-template-columns: repeat(auto-fit,minmax(125px,1fr)); gap: .5rem; }
fieldset { min-width: 0; border: 1px solid #dce4ef; border-radius: 10px; padding: .75rem; margin: 1rem 0; }
</style>
