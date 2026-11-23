<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { equipment } from '../data/catalog.js'
import { filterExercises } from '../services/domain.js'
import BodyPartSelector from '../components/BodyPartSelector.vue'
import ExerciseEditor from '../components/ExerciseEditor.vue'
import { clone } from '../services/domain.js'
import ExerciseCard from '../components/ExerciseCard.vue'
import ExerciseArt from '../components/ExerciseArt.vue'
defineOptions({ name: 'ExerciseLibrary' })
const store = useAppStore(),
  route = useRoute(),
  router = useRouter(),
  { t, locale } = useI18n(),
  editing = ref(null),
  saving = ref(false),
  formError = ref(''),
  detail = ref(null),
  adding = ref(null),
  planId = ref(''),
  message = ref('')
const filters = reactive({
  query: '',
  part: route.query.part || '',
  type: '',
  difficulty: '',
  equipment: [],
  owned: false,
  favorites: false,
})
watch(
  () => route.query.part,
  (p) => {
    if (p) filters.part = p
  },
)
const visible = computed(() =>
  filterExercises(store.exercises, { ...filters, favoriteIds: store.data.favorites }),
)
function clear() {
  Object.assign(filters, {
    query: '',
    part: '',
    type: '',
    difficulty: '',
    equipment: [],
    owned: false,
    favorites: false,
  })
}
function add() {
  let plan = store.data.plans.find((p) => p.id === planId.value)
  if (!plan) {
    const id = store.savePlan({
      name: t('newName'),
      description: '',
      sets: 3,
      mode: 'straight',
      prepare: 5,
      setRest: 30,
      transitionRest: 20,
      roundRest: 60,
      cooldown: 10,
      items: [],
    })
    plan = store.data.plans.find((p) => p.id === id)
  }
  plan.items.push({ exerciseId: adding.value.id, mode: adding.value.mode, target: adding.value.mode === 'time' ? 30 : 12, weight: 0, exercise: clone(adding.value) })
  adding.value = null
  message.value = t('added')
  if (route.query.return) router.push('/plans?edit=' + plan.id)
}
async function saveExercise(value) {
  saving.value = true; formError.value = ''
  try { await store.saveExercise(value); editing.value = null; message.value = t('saved') }
  catch(e) { formError.value = e.message === 'invalidExercise' ? 'invalidExercise' : 'storageError' }
  finally { saving.value = false }
}
async function removeExercise(exercise) {
  if (!confirm(t('exerciseDeleteConfirm', { name: exercise.name[locale.value] }))) return
  try { await store.removeExercise(exercise.id); detail.value = null; message.value = t('exerciseDeleted') }
  catch { message.value = t('storageError') }
}
function editExercise(exercise) { formError.value = ''; editing.value = clone(exercise) }
function addDetail(){adding.value=detail.value;detail.value=null}
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ t('exerciseEyebrow') }}</p>
      <h1>{{ t('exercises') }}</h1>
      <p class="muted">{{ t('explore') }}</p>
    </div>
    <div class="form-actions">
      <button class="button primary" @click="editExercise({})">{{ t('newExercise') }}</button>
      <RouterLink to="/plans" class="button soft">{{ t('plans') }}</RouterLink>
    </div>
  </div>
  <p v-if="message" role="status" class="alert">
    {{ message
    }}<button @click="message = ''" :aria-label="t('close')">
      <X :size="18" />
    </button>
  </p>
  <div class="library-layout">
    <aside class="filter-panel panel">
      <BodyPartSelector v-model="filters.part" />
      <hr />
      <h3>{{ t('equipment') }}</h3>
      <label v-for="e in equipment" :key="e" class="checkbox"
        ><input type="checkbox" :value="e" v-model="filters.equipment" />{{
          t('labels.' + e)
        }}</label
      ><label class="checkbox owned"
        ><input type="checkbox" v-model="filters.owned" />{{ t('owned') }}</label
      >
    </aside>
    <section>
      <div class="search-box">
        <Search :size="20" /><input
          v-model="filters.query"
          :placeholder="t('search')"
          :aria-label="t('search')"
        />
      </div>
      <div class="filter-row">
        <label
          >{{ t('type')
          }}<select v-model="filters.type">
            <option value="">{{ t('all') }}</option>
            <option v-for="k in ['strength', 'cardio', 'mobility', 'recovery']" :key="k" :value="k">
              {{ t(k) }}
            </option>
          </select></label
        ><label
          >{{ t('difficulty')
          }}<select v-model="filters.difficulty">
            <option value="">{{ t('all') }}</option>
            <option v-for="k in ['beginner', 'intermediate', 'advanced']" :key="k" :value="k">
              {{ t(k) }}
            </option>
          </select></label
        ><label class="checkbox"
          ><input type="checkbox" v-model="filters.favorites" />{{ t('favorites') }}</label
        >
      </div>
      <div class="section-heading">
        <span class="muted">{{ t('results', { count: visible.length }) }}</span><button
          class="text-button"
          @click="clear"
        >
          {{ t('clear') }}
        </button>
      </div>
      <div class="chips">
        <button v-if="filters.part" @click="filters.part = ''">
          {{ t('labels.' + filters.part) }} ×</button
        ><button
          v-for="e in filters.equipment"
          :key="e"
          @click="filters.equipment = filters.equipment.filter((x) => x !== e)"
        >
          {{ t('labels.' + e) }} ×</button
        ><button v-if="filters.type" @click="filters.type = ''">{{ t(filters.type) }} ×</button
        ><button v-if="filters.difficulty" @click="filters.difficulty = ''">
          {{ t(filters.difficulty) }} ×
        </button>
      </div>
      <p v-if="!visible.length" class="empty-state">{{ t('noResults') }}</p>
      <div class="exercise-grid">
        <ExerciseCard
          v-for="e in visible"
          :key="e.id"
          :exercise="e"
          :favorite="store.data.favorites.includes(e.id)"
          @edit="editExercise(e)"
          @delete="removeExercise(e)"
          @details="detail = e"
          @favorite="store.toggleFavorite(e.id)"
          @add="adding = e"
        />
      </div>
      <p class="muted small">{{ t('placeholder') }}</p>
    </section>
  </div>
  <ExerciseEditor v-if="editing" :key="editing.id || 'new'" :exercise="editing" :busy="saving" :error="formError" @save="saveExercise" @cancel="editing = null" />
  <div v-if="detail" class="modal-overlay" @click.self="detail = null">
    <section class="modal" role="dialog" aria-modal="true" :aria-label="t('details')">
      <div class="section-heading">
        <h2>{{ detail.name[locale] }}</h2>
        <button @click="detail = null" :aria-label="t('close')"><X /></button>
      </div>
      <ExerciseArt :part="detail.primary[0]" large />
      <p class="small muted">{{ t('placeholder') }}</p>
      <p>{{ detail.name[locale === 'en' ? 'zh-TW' : 'en'] }}</p>
      <p>{{ t(detail.type) }} · {{ t(detail.difficulty) }}</p>
      <p>
        <b>{{ t('equipment') }}:</b>
        {{ detail.equipment.map((x) => t('labels.' + x)).join(' · ') }}
      </p>
      <p>
        <b>{{ t('primary') }}:</b>
        {{ detail.primary.map((x) => t('labels.' + x)).join(' · ') }}
      </p>
      <h3>{{ t('steps') }}</h3>
      <ol>
        <li v-for="s in detail.steps[locale]" :key="s">{{ s }}</li>
      </ol>
      <p class="callout">{{ t('safety') }}</p>
      <button
        class="button primary"
        @click="addDetail"
      >
        {{ t('addToPlan') }}
      </button>
    </section>
  </div>
  <div v-if="adding" class="modal-overlay" @click.self="adding = null">
    <form
      class="modal compact"
      role="dialog"
      aria-modal="true"
      :aria-label="t('addToPlan')"
      @submit.prevent="add"
    >
      <h2>{{ t('addToPlan') }}</h2>
      <p>{{ adding.name[locale] }}</p>
      <label
        >{{ t('selectPlan')
        }}<select v-model="planId">
          <option value="">{{ t('newPlan') }}</option>
          <option v-for="p in store.data.plans" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select></label
      >
      <div class="form-actions">
        <button type="button" @click="adding = null">{{ t('cancel') }}</button><button
          class="button primary"
        >
          {{ t('add') }}
        </button>
      </div>
    </form>
  </div>
</template>
