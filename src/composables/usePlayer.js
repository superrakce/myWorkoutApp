import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app.js'
import { clone, timeline, uid, validatePlan } from '../services/domain.js'
export function usePlayer(plan, onCue) {
  const store = useAppStore(),
    owned = ref(false),
    busy = ref(false),
    now = ref(Date.now())
  let interval,
    release,
    lastManualAction = 0,
    anchor = Date.now(),
    wake,
    disposed = false
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
    if (!store.data.active && validatePlan(plan, store.findExercise)) {
      const snapshot = {
        ...clone(plan),
        items: plan.items.map((i) => ({
          ...clone(i),
          exercise: clone(i.exercise || store.findExercise(i.exerciseId)),
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
      return true
    }
    return false
  }
  async function acquire() {
    if (!navigator.locks) {
      busy.value = true
      return
    }
    navigator.locks.request('form-workout-player', { ifAvailable: true }, async (lock) => {
      if (disposed) return
      if (!lock) {
        busy.value = true
        return
      }
      const held = new Promise((resolve) => (release = resolve))
      owned.value = true
      if (create() && plan.tabata && !document.hidden) resume()
      await held
      owned.value = false
    })
  }
  async function resume() {
    if (!owned.value || !stage.value || finished.value) return
    const starting = session.value.status === 'ready'
    session.value.status = stage.value.phase
    anchor = Date.now()
    if (starting) onCue(stage.value.phase, Math.ceil(remaining.value))
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
    const before = remaining.value
    const delta = before === null ? dt : Math.min(dt, before)
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
    const after = remaining.value
    if (after === 0) {
      advance(false, true)
    } else if (after !== null && ['working', 'resting'].includes(stage.value.phase)) {
      const second = Math.ceil(after)
      if (second <= 3 && second < Math.ceil(before)) {
        onCue(stage.value.phase + 'Ending', second)
      }
    }
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
        exercise: clone(s.exercise || store.findExercise(s.exerciseId)),
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
    onCue(session.value.status, Math.ceil(remaining.value))
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
        exercise: clone(s.exercise || store.findExercise(s.exerciseId)),
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
  async function discard() {
    if (!owned.value || !finished.value) return false
    const discarded = session.value
    const scope = store.scope
    store.data.active = null
    try {
      await store.persist()
    } catch {
      if (store.scope === scope && !store.data.active) store.data.active = discarded
      return false
    }
    release?.()
    return store.scope === scope
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
    disposed = true
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
    discard,
  }
}
