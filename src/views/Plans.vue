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
  () => route.query.edit,
  (id) => {
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
    mode: 'straight',
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
    <div>
      <p class="eyebrow">{{ t('planEyebrow') }}</p>
      <h1>{{ t('plans') }}</h1>
    </div>
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
      <div v-for="p in store.data.plans" :key="p.id">
        <PlanCard
          :plan="p"
          @start="router.push('/player?plan=' + p.id)"
          @edit="router.push('/plans?edit=' + p.id)"
        />
        <div class="plan-tools">
          <button @click="p.favorite = !p.favorite" :aria-label="t('favorite')">
            <Heart :size="17" :fill="p.favorite ? 'currentColor' : 'none'" /></button
          ><button @click="duplicate(p)"><Copy :size="16" />{{ t('duplicate') }}</button
          ><button @click="remove(p.id)"><Trash2 :size="16" />{{ t('delete') }}</button>
        </div>
      </div>
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
