<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Play, Pause, SkipForward, Square } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { templates } from '../data/catalog.js'
import { clone } from '../services/domain.js'
import { usePlayer } from '../composables/usePlayer.js'
import ExerciseArt from '../components/ExerciseArt.vue'
import SessionSummary from '../components/SessionSummary.vue'
const store = useAppStore(),
  route = useRoute(),
  router = useRouter(),
  { t, locale } = useI18n()
let plan = clone(
  store.data.plans.find((p) => p.id === route.query.plan) ||
    templates.find((p) => p.id === route.query.plan) ||
    templates[0],
)
if (typeof plan.name === 'object') {
  plan.name = plan.name[locale.value]
  plan.description = plan.description[locale.value]
}
const { session, stage, remaining, finished, owned, busy, resume, pause, advance, end, save, discard } =
  usePlayer(plan, start)
const exercise = computed(() =>
    stage.value?.exerciseId ? stage.value.exercise || store.findExercise(stage.value.exerciseId) : null,
  ),
  next = computed(() =>
    session.value?.stages.slice(session.value.cursor + 1).find((s) => s.phase === 'working'),
  )
const audio = ref(null),
  audioError = ref(false),
  summaryPending = ref(false)
let objectUrl, context
function file(event) {
  if (!event.target.files?.length) return
  audio.value?.pause()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(event.target.files[0])
  audio.value = new Audio(objectUrl)
  audio.value.loop = true
  audio.value.volume = store.data.settings.musicVolume
  audio.value.onerror = () => (audioError.value = true)
  if (!['ready', 'paused'].includes(session.value.status)) playAudio()
}
async function playAudio() {
  if (!audio.value) return
  try {
    await audio.value.play()
    audioError.value = false
  } catch {
    audioError.value = true
  }
}
function start() {
  try {
    context ??= new AudioContext()
    context.resume().catch(() => {})
  } catch {}
  resume()
  playAudio()
}
watch(
  () => session.value?.status,
  (s) => {
    if (['paused', 'completed', 'aborted', 'ready'].includes(s)) audio.value?.pause()
  },
)
watch(
  () => store.data.settings.musicVolume,
  (v) => {
    if (audio.value) audio.value.volume = v
  },
)
watch(
  () => session.value?.cursor,
  () => {
    if (!store.data.settings.cueVolume) return
    try {
      context ??= new AudioContext()
      const oscillator = context.createOscillator(),
        gain = context.createGain()
      oscillator.connect(gain)
      gain.connect(context.destination)
      gain.gain.value = store.data.settings.cueVolume * 0.1
      oscillator.frequency.value = 660
      oscillator.start()
      oscillator.stop(context.currentTime + 0.12)
    } catch {}
  },
)
async function saveSession(draft) {
  if (summaryPending.value) return
  summaryPending.value = true
  try {
    store.data.active = draft
    await save()
    await router.push('/history')
  } finally {
    summaryPending.value = false
  }
}
async function discardSession() {
  if (summaryPending.value) return
  summaryPending.value = true
  try {
    if (await discard()) await router.push('/plans')
  } finally {
    summaryPending.value = false
  }
}
onUnmounted(() => {
  audio.value?.pause()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  context?.close()
})
</script>
<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ t(session?.snapshot.tabata ? 'tabata' : 'player') }}</p>
      <h1>{{ session?.snapshot.name || plan.name }}</h1>
    </div>
  </div>
  <p v-if="busy" class="callout">{{ t('busy') }}</p>
  <template v-if="session && owned"
    ><SessionSummary
      v-if="finished"
      :session="session"
      :pending="summaryPending"
      can-discard
      @save="saveSession"
      @discard="discardSession"
    />
    <div v-else class="player-layout">
      <section class="panel workout-stage">
        <div class="section-heading">
          <span class="pill" aria-live="polite">{{
            t(
              session.status === 'paused'
                ? 'paused'
                : session.status === 'ready'
                  ? 'ready'
                  : stage?.phase === 'resting'
                    ? 'restingPhase'
                    : stage?.phase === 'cooldown'
                      ? 'cooldownPhase'
                      : stage?.phase || 'ready',
            )
          }}</span><span>{{ session.cursor + 1 }} / {{ session.stages.length }}</span>
        </div>
        <ExerciseArt :part="exercise?.primary[0]" large />
        <p class="muted small">{{ t('placeholder') }}</p>
        <h2>
          {{ exercise?.name[locale] || t(stage?.phase === 'resting' ? 'rest' : stage?.phase==='cooldown'?'cooldownPhase':'prepare') }}
        </h2>
        <p v-if="stage?.set">
          {{ t('setProgress', { set: stage.set, total: session.snapshot.sets }) }}
          · {{ stage.weight }} kg
        </p>
        <div class="timer">
          {{ remaining === null ? stage?.target : Math.ceil(remaining)
          }}<small>{{ t(remaining === null ? 'reps' : 'seconds') }}</small>
        </div>
        <div class="progress">
          <span
            :style="{
              width: (session.cursor / session.stages.length) * 100 + '%',
            }"
          />
        </div>
        <div class="player-controls">
          <button
            v-if="['ready', 'paused'].includes(session.status)"
            class="button accent"
            @click="start"
          >
            <Play :size="20" />{{ t(session.status === 'ready' ? 'start' : 'resume') }}</button
          ><button v-else class="button primary" @click="pause">
            <Pause :size="20" />{{ t('pause') }}</button
          ><button
            v-if="stage?.phase === 'working' && stage?.mode === 'reps'"
            class="button primary"
            :disabled="['ready', 'paused'].includes(session.status)"
            @click="advance(false)"
          >
            {{ t('finishSet') }}</button
          ><button
            class="button soft"
            :disabled="['ready', 'paused'].includes(session.status)"
            @click="advance(true)"
          >
            <SkipForward :size="18" />{{
              t(stage?.phase === 'working' ? 'skip' : 'skipRest')
            }}</button
          ><button class="button danger" @click="end"><Square :size="16" />{{ t('end') }}</button>
        </div>
        <div v-if="next" class="next-up">
          <span>{{ t('next') }}</span><b>{{ (next.exercise || store.findExercise(next.exerciseId))?.name[locale] }}</b>
        </div>
      </section>
      <aside class="panel music-panel">
        <h3>{{ t('music') }}</h3>
        <input type="file" accept="audio/*" :aria-label="t('music')" @change="file" /><label
          >{{ t('musicVolume')
          }}<input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model.number="store.data.settings.musicVolume" /></label
        ><label
          >{{ t('cueVolume')
          }}<input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model.number="store.data.settings.cueVolume"
        /></label>
        <p v-if="audioError" class="error">
          {{ t('audioFailed') }}<button @click="playAudio">{{ t('retry') }}</button>
        </p>
        <p class="muted">{{ t('summaryHint') }}</p>
      </aside>
    </div></template
  >
</template>
