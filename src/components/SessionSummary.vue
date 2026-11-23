<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { clone, distribution } from '../services/domain.js'
import TrainingRadar from './TrainingRadar.vue'
const props = defineProps({ session: { type: Object, required: true } }),
  emit = defineEmits(['save']),
  { t, locale } = useI18n(),
  draft = ref(clone(props.session))
function save() {
  emit('save', clone(draft.value))
}
</script>
<template>
  <form @submit.prevent="save" class="editor-layout">
    <section class="panel editor-form">
      <h2>{{ t('summary') }}</h2>
      <p class="muted">{{ t('summaryHint') }}</p>
      <p>
        {{ t(draft.status) }} ·
        {{ t('countSets', { count: draft.logs.length }, draft.logs.length) }}
      </p>
      <div v-for="(log, index) in draft.logs" :key="log.id" class="summary-row">
        <b>{{ log.exercise.name[locale] }} · {{ log.set }}</b>
        <div class="form-grid">
          <label
            >{{ t('actualValue')
            }}<input
              type="number"
              :min="log.status === 'completed' ? 1 : 0"
              required
              v-model.number="log.actual" /></label
          ><label
            >{{ t('weight')
            }}<input type="number" min="0" step="0.1" required v-model.number="log.weight"
          /></label>
        </div>
        <label class="checkbox"
          ><input
            type="checkbox"
            :checked="log.status === 'completed'"
            @change="log.status = $event.target.checked ? 'completed' : 'skipped'"
          />{{ t('confirmed') }}</label
        >
      </div>
      <div class="form-grid">
        <label
          >{{ t('effectiveMinutes')
          }}<input
            type="number"
            min="0"
            step="any"
            max="1440"
            required
            v-model.number="draft.minutes" /></label
        ><label
          >{{ t('met')
          }}<input type="number" min="0" max="25" step="0.1" required v-model.number="draft.met"
        /></label>
      </div>
      <p class="small muted">{{ t('energyHint') }}</p>
      <label>{{ t('notes') }}<textarea v-model="draft.notes" maxlength="2000" /></label
      ><button class="button primary">{{ t('saveSession') }}</button>
    </section>
    <aside class="panel">
      <TrainingRadar :data="distribution(draft.logs)" actual />
    </aside>
  </form>
</template>
