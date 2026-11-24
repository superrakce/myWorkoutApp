<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-vue-next'
import { clone, validatePlan, planDistribution, duration } from '../services/domain.js'
import { useAppStore } from '../stores/app.js'
const store = useAppStore()
import TrainingRadar from './TrainingRadar.vue'
const props = defineProps({ plan: { type: Object, required: true } }),
  emit = defineEmits(['save', 'cancel']),
  { t, locale } = useI18n(),
  router = useRouter()
const draft = ref(clone(props.plan)),
  invalid = ref(false),
  radar = computed(() => planDistribution(draft.value))
const intervalRest = computed({
  get: () => draft.value.setRest,
  set: (value) => {
    draft.value.setRest = value
    draft.value.transitionRest = value
    draft.value.roundRest = value
  },
})
const playbackMode = computed({
  get: () => draft.value.tabata ? 'tabata' : draft.value.mode,
  set: (mode) => {
    if (mode !== 'tabata') {
      delete draft.value.tabata
      draft.value.mode = mode
      return
    }
    draft.value.tabata = true
    draft.value.mode = 'circuit'
    if (!draft.value.items.length) draft.value.sets = 8
    intervalRest.value = 10
    for (const item of draft.value.items) {
      if (item.mode === 'time') continue
      item.mode = 'time'
      item.target = 20
    }
  },
})
const restFields = computed(() => draft.value.tabata
  ? ['prepare', 'cooldown']
  : ['prepare', 'setRest', 'transitionRest', 'roundRest', 'cooldown'])
function move(i, d) {
  const j = i + d
  if (j < 0 || j >= draft.value.items.length) return
  ;[draft.value.items[i], draft.value.items[j]] = [draft.value.items[j], draft.value.items[i]]
}
function save() {
  if (!validatePlan(draft.value, store.findExercise)) {
    invalid.value = true
    return
  }
  emit('save', draft.value)
}
function add() {
  const id = store.savePlan(draft.value)
  router.push({ path: '/exercises', query: { return: 'plan', plan: id } })
}
</script>
<template>
  <form @submit.prevent="save" class="editor-layout">
    <section class="panel editor-form">
      <div class="form-grid">
        <label>{{ t('name') }}<input v-model.trim="draft.name" required maxlength="120" /></label
        ><label
          >{{ t(draft.tabata ? 'tabataRounds' : 'sets')
          }}<input type="number" v-model.number="draft.sets" min="1" max="100" required /></label
        ><label class="full"
          >{{ t('description') }}<input v-model="draft.description" maxlength="500" /></label
        ><label
          >{{ t('mode')
          }}<select v-model="playbackMode">
            <option value="straight">{{ t('straight') }}</option>
            <option value="circuit">{{ t('circuit') }}</option>
            <option value="tabata">{{ t('tabata') }}</option>
          </select></label
        ><label
          v-for="k in restFields"
          :key="k"
          >{{ t(k) }} ({{ t('seconds') }})<input
            type="number"
            min="0"
            max="3600"
            v-model.number="draft[k]"
            required
        /></label>
        <label v-if="draft.tabata">
          {{ t('tabataRest') }} ({{ t('seconds') }})
          <input type="number" min="0" max="3600" v-model.number="intervalRest" required />
        </label>
      </div>
      <div class="section-heading">
        <h3>{{ t('exercises') }}</h3>
        <button type="button" class="text-button" @click="add">
          <Plus :size="16" />{{ t('add') }}
        </button>
      </div>
      <article v-for="(i, index) in draft.items" :key="index" class="plan-item">
        <div class="section-heading">
          <h3>
            {{ index + 1 }}.
            {{ (i.exercise || store.findExercise(i.exerciseId))?.name[locale] || i.exerciseId }}
          </h3>
          <div class="icon-actions">
            <button
              type="button"
              @click="move(index, -1)"
              :disabled="index === 0"
              :aria-label="t('up')"
            >
              <ArrowUp :size="16" /></button
            ><button
              type="button"
              @click="move(index, 1)"
              :disabled="index === draft.items.length - 1"
              :aria-label="t('down')"
            >
              <ArrowDown :size="16" /></button
            ><button type="button" @click="draft.items.splice(index, 1)" :aria-label="t('remove')">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
        <div class="form-grid three">
          <label v-if="!draft.tabata"
            >{{ t('mode')
            }}<select v-model="i.mode">
              <option value="reps">{{ t('reps') }}</option>
              <option value="time">{{ t('seconds') }}</option>
            </select></label
          ><label
            >{{ t(draft.tabata ? 'tabataWork' : 'target')
            }}<input type="number" min="1" v-model.number="i.target" required /></label
          ><label
            >{{ t('weight')
            }}<input type="number" min="0" step="0.1" v-model.number="i.weight" required
          /></label>
        </div>
      </article>
      <p v-if="!draft.items.length" class="callout">{{ t('invalidPlan') }}</p>
      <p v-if="invalid" class="error" role="alert">{{ t('invalidPlan') }}</p>
      <p class="muted">
        {{ duration(draft) === null ? t('timeUnknown') : duration(draft) + ' ' + t('seconds') }}
      </p>
      <div class="form-actions">
        <button type="button" @click="$emit('cancel')">{{ t('cancel') }}</button><button
          class="button primary"
        >
          {{ t('save') }}
        </button>
      </div>
    </section>
    <aside class="panel"><TrainingRadar :data="radar" /></aside>
  </form>
</template>
