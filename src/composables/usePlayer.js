import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app.js'
import { clone, timeline, uid, validatePlan } from '../services/domain.js'
import { findExercise } from '../data/catalog.js'
export function usePlayer(plan) {
  const store = useAppStore(),
    owned = ref(false),
    busy = ref(false),
    now = ref(Date.now())
  let interval,
    release,
    lastManualAction = 0,
    anchor = Date.now(),
    wake
  const session = computed(() => store.data.active),
    stage = computed(() => session.value?.stages[session.value.cursor]),
    remaining = computed(() =>
      stage.value?.seconds == null
        ? null
        : Math.max(0, stage.value.seconds - session.value.elapsed),
    ),
    finished = computed(() => ['completed', 'aborted'].includes(session.value?.status))
  function checkpoint() {
    store.persist().catch(() => {})
  }
  function create() {
    if (!store.data.active && validatePlan(plan)) {
      const snapshot = {
        ...clone(plan),
        items: plan.items.map((i) => ({
          ...clone(i),
          exercise: clone(findExercise(i.exerciseId)),
        })),
      }
      store.data.active = {
        id: uid(),
        snapshot,
        startedAt: new Date().toISOString(),
        stages: timeline(snapshot),
        cursor: 0,
        elapsed: 0,
        activeSeconds: 0,
        activitySegments: [],
        status: 'ready',
        logs: [],
        minutes: 0,
        met: 0,
        notes: '',
        source: 'player',
      }
    }
  }
  async function acquire() {
    if (!navigator.locks) {
      busy.value = true
      return
    }
    navigator.locks.request('form-workout-player', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        busy.value = true
        return
      }
      owned.value = true
      create()
      await new Promise((r) => (release = r))
      owned.value = false
    })
  }
  async function resume() {
    if (!owned.value || !stage.value || finished.value) return
    session.value.status = stage.value.phase
    anchor = Date.now()
    try {
      wake = await navigator.wakeLock?.request('screen')
    } catch {}
    checkpoint()
  }
  function tick() {
    const time = Date.now()
    now.value = time
    if (
      !owned.value ||
      !session.value ||
      ['ready', 'paused', 'completed', 'aborted'].includes(session.value.status)
    ) {
      anchor = time
      return
    }
    const from = anchor
    const dt = Math.max(0, (time - anchor) / 1000)
    anchor = time
    const timed = stage.value.seconds !== null
    const delta = timed
      ? Math.min(dt, Math.max(0, stage.value.seconds - session.value.elapsed))
      : dt
    session.value.elapsed += delta
    if (stage.value.phase === 'working') {
      session.value.activeSeconds += delta
      session.value.activitySegments ||= []
      const segments = session.value.activitySegments,
        last = segments.at(-1)
      if (last && Math.abs(new Date(last.end).getTime() - from) < 150)
        last.end = new Date(from + delta * 1000).toISOString()
      else
        segments.push({
          start: new Date(from).toISOString(),
          end: new Date(from + delta * 1000).toISOString(),
        })
    }
    if (timed && session.value.elapsed >= stage.value.seconds) advance(false, true)
  }
  function pause() {
    tick()
    if (!session.value || finished.value || session.value.status === 'ready') return
    session.value.status = 'paused'
    wake?.release().catch(() => {})
    checkpoint()
  }
  function advance(skipped = false, automatic = false) {
    if (
      !owned.value ||
      !stage.value ||
      finished.value ||
      ['paused', 'ready'].includes(session.value.status)
    )
      return
    if (!automatic) {
      const at = Date.now()
      if (at - lastManualAction < 350) return
      lastManualAction = at
    }
    const s = stage.value
    if (s.phase === 'working') {
      const log = {
        id: uid(),
        exerciseId: s.exerciseId,
        exercise: clone(s.exercise || findExercise(s.exerciseId)),
        set: s.set,
        mode: s.mode,
        target: s.target,
        weight: s.weight,
        actual: skipped ? (s.mode === 'time' ? Math.floor(session.value.elapsed) : 0) : s.target,
        status: skipped ? 'skipped' : 'completed',
        completedAt: new Date().toISOString(),
        seconds: session.value.elapsed,
      }
      session.value.logs.push(log)
    }
    session.value.cursor++
    session.value.elapsed = 0
    anchor = Date.now()
    if (!stage.value) {
      session.value.status = 'completed'
      session.value.endedAt = new Date().toISOString()
      session.value.minutes = session.value.activeSeconds / 60
      wake?.release().catch(() => {})
    } else session.value.status = stage.value.phase
    checkpoint()
  }
  function end() {
    if (!owned.value || finished.value) return
    tick()
    if (finished.value) return
    if (stage.value?.phase === 'working') {
      const s = stage.value
      session.value.logs.push({
        id: uid(),
        exerciseId: s.exerciseId,
        exercise: clone(s.exercise || findExercise(s.exerciseId)),
        set: s.set,
        mode: s.mode,
        target: s.target,
        weight: s.weight,
        actual: s.mode === 'time' ? Math.floor(session.value.elapsed) : 0,
        status: 'skipped',
        completedAt: new Date().toISOString(),
        seconds: session.value.elapsed,
      })
    }
    session.value.status = 'aborted'
    session.value.endedAt = new Date().toISOString()
    session.value.minutes = session.value.activeSeconds / 60
    checkpoint()
  }
  async function save() {
    if (!owned.value || !finished.value) return
    const copy = clone(session.value)
    copy.status =
      copy.status === 'aborted'
        ? 'aborted'
        : copy.logs.every((l) => l.status === 'completed')
          ? 'completed'
          : 'partial'
    delete copy.stages
    delete copy.cursor
    delete copy.elapsed
    if (!store.data.sessions.some((s) => s.id === copy.id)) store.data.sessions.push(copy)
    store.data.active = null
    await store.persist()
    release?.()
  }
  function visibility() {
    if (document.hidden) pause()
  }
  function pagehide() {
    pause()
  }
  onMounted(() => {
    acquire()
    interval = setInterval(tick, 100)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pagehide)
  })
  onUnmounted(() => {
    pause()
    clearInterval(interval)
    release?.()
    wake?.release().catch(() => {})
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pagehide', pagehide)
  })
  return {
    session,
    stage,
    remaining,
    finished,
    owned,
    busy,
    resume,
    pause,
    advance,
    end,
    save,
  }
}
