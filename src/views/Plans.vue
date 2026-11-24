<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Copy, Trash2, Heart } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { templates } from '../data/catalog.js'
import { clone } from '../services/domain.js'
import PlanCard from '../components/PlanCard.vue'
import PlanEditor from '../components/PlanEditor.vue'
const store = useAppStore(),
  { t, locale } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  editing = ref(null)
watch(
  () => [route.query.edit, route.query.new],
  ([id, isNew]) => {
    if (isNew === '1') {
      create()
      return
    }
    editing.value = store.data.plans.find((p) => p.id === id) || null
  },
  { immediate: true },
)
function cancelEdit(){editing.value=null;router.replace('/plans')}
function create() {
  editing.value = {
    name: t('newName'),
    description: '',
    sets: 3,
    mode: 'circuit',
    prepare: 5,
    setRest: 30,
    transitionRest: 20,
    roundRest: 60,
    cooldown: 10,
    items: [],
  }
}
function useTemplate(p) {
  const d = clone(p)
  d.id = null
  d.name = p.name[locale.value]
  d.description = p.description[locale.value]
  const id = store.savePlan(d)
  router.push('/plans?edit=' + id)
}
function save(p) {
  store.savePlan(p)
  editing.value = null
  router.replace('/plans')
}
function duplicate(p) {
  const d = clone(p)
  d.id = null
  d.name += ' (2)'
  store.savePlan(d)
}
function remove(id) {
  if (confirm(t('confirmDelete'))) store.data.plans = store.data.plans.filter((p) => p.id !== id)
}
</script>
<template>
  <div class="page-heading">
    <h1>{{ t('plans') }}</h1>
    <button v-if="!editing" class="button primary" @click="create">
      <Plus :size="18" />{{ t('newPlan') }}
    </button>
  </div>
  <PlanEditor
    v-if="editing"
    :key="editing.id || 'new'"
    :plan="editing"
    @save="save"
    @cancel="cancelEdit"
  /><template v-else
    ><p v-if="!store.data.plans.length" class="callout">{{ t('noPlans') }}</p>
    <div class="plan-grid">
      <PlanCard
        v-for="p in store.data.plans"
        :key="p.id"
        :plan="p"
        @start="router.push('/player?plan=' + p.id)"
        @edit="router.push('/plans?edit=' + p.id)"
      >
        <template #actions>
          <button
            class="card-icon-button"
            :class="{ active: p.favorite }"
            :aria-label="t('favorite')"
            :aria-pressed="Boolean(p.favorite)"
            :title="t('favorite')"
            @click="p.favorite = !p.favorite"
          ><Heart :size="17" :fill="p.favorite ? 'currentColor' : 'none'" /></button>
          <button class="card-icon-button" :aria-label="t('duplicate')" :title="t('duplicate')" @click="duplicate(p)">
            <Copy :size="16" />
          </button>
          <button class="card-icon-button" :aria-label="t('delete')" :title="t('delete')" @click="remove(p.id)">
            <Trash2 :size="16" />
          </button>
        </template>
      </PlanCard>
    </div>
    <div class="section-heading spaced">
      <h2>{{ t('templates') }}</h2>
    </div>
    <div class="plan-grid">
      <PlanCard
        v-for="p in templates"
        :key="p.id"
        :plan="p"
        is-template
        @use="useTemplate(p)"
        @start="router.push('/player?plan=' + p.id)"
      /></div
  ></template>
</template>
