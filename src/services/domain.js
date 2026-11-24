import { validateExercise } from './exerciseLibrary.js'
import { axes, partAxis, findExercise } from '../data/catalog.js'
export const clone = (v) => JSON.parse(JSON.stringify(v))
export const uid = () => crypto.randomUUID()
export function noonInZone(date, timeZone = 'Asia/Taipei') {
  let stamp = new Date(date + 'T12:00:00Z').getTime()
  const target = stamp
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      format.formatToParts(new Date(stamp)).map((x) => [x.type, x.value]),
    )
    const shown = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    )
    stamp += target - shown
  }
  return new Date(stamp).toISOString()
}
export function localDate(timestamp = new Date(), timeZone = 'Asia/Taipei') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp))
}
export function filterExercises(list, f) {
  const q = (f.query || '').toLowerCase()
  return list.filter(
    (e) =>
      (!q || [...Object.values(e.name), ...e.aliases].some((x) => x.toLowerCase().includes(q))) &&
      (!f.part || e.primary.some((p) => p === f.part || partAxis[p] === f.part)) &&
      (!f.type || e.type === f.type) &&
      (!f.difficulty || e.difficulty === f.difficulty) &&
      (!f.favorites || f.favoriteIds?.includes(e.id)) &&
      (f.owned
        ? e.requiredEquipment.length > 0 &&
          e.requiredEquipment.every((x) => (f.equipment || []).includes(x))
        : !f.equipment?.length || e.equipment.some((x) => f.equipment.includes(x))),
  )
}
export function distribution(sets) {
  const values = Object.fromEntries(axes.map((x) => [x, 0]))
  let unclassified = 0
  for (const s of sets) {
    const e = s.exercise || findExercise(s.exerciseId)
    if (s.status !== 'completed' || e?.type !== 'strength') continue
    const mapped = [...new Set(e.primary.map((p) => partAxis[p]).filter(Boolean))]
    const amount = s.side === 'left' || s.side === 'right' ? 0.5 : 1
    if (!mapped.length) {
      unclassified += amount
      continue
    }
    for (const axis of mapped) values[axis] += amount / mapped.length
  }
  const total = Object.values(values).reduce((a, b) => a + b, 0)
  return {
    values,
    total,
    unclassified,
    percent: Object.fromEntries(axes.map((x) => [x, total ? (values[x] / total) * 100 : 0])),
  }
}
export function planDistribution(plan) {
  return distribution(
    plan.items.flatMap((i) =>
      Array.from({ length: plan.sets }, () => ({ ...i, status: 'completed' })),
    ),
  )
}
export function validatePlan(p, lookup = findExercise) {
  return Boolean(
    typeof p.name === 'string' &&
    p.name.trim() &&
    Number.isInteger(p.sets) &&
    p.sets >= 1 &&
    p.sets <= 100 &&
    Array.isArray(p.items) &&
    p.items.length &&
    ['straight', 'circuit'].includes(p.mode) &&
    (p.tabata === undefined || typeof p.tabata === 'boolean') &&
    (!p.tabata || (p.mode === 'circuit' && p.setRest === p.transitionRest && p.setRest === p.roundRest)) &&
    (p.plannedMet == null || (Number.isFinite(p.plannedMet) && p.plannedMet > 0 && p.plannedMet <= 25)) &&
    (p.plannedActiveMinutes == null ||
      (Number.isFinite(p.plannedActiveMinutes) && p.plannedActiveMinutes > 0 && p.plannedActiveMinutes <= 1440)) &&
    ['prepare', 'setRest', 'transitionRest', 'roundRest', 'cooldown'].every(
      (k) => Number.isFinite(p[k]) && p[k] >= 0,
    ) &&
    p.items.every(
      (i) =>
        (i.exercise ? i.exercise.id === i.exerciseId && validateExercise(i.exercise) : lookup(i.exerciseId)) &&
        (p.tabata ? i.mode === 'time' : ['time', 'reps'].includes(i.mode)) &&
        Number.isFinite(i.target) &&
        i.target > 0 &&
        Number.isFinite(i.weight) &&
        i.weight >= 0,
    ),
  )
}
export function timeline(p) {
  const work = []
  if (p.mode === 'straight') {
    p.items.forEach((item, index) => {
      for (let set = 1; set <= p.sets; set++) work.push({ ...clone(item), index, set })
    })
  } else {
    for (let set = 1; set <= p.sets; set++)
      p.items.forEach((item, index) => work.push({ ...clone(item), index, set }))
  }
  const stages = []
  if (p.prepare) stages.push({ phase: 'preparing', seconds: p.prepare })
  work.forEach((w, i) => {
    stages.push({
      ...w,
      phase: 'working',
      seconds: w.mode === 'time' ? w.target : null,
    })
    const next = work[i + 1]
    if (next) {
      const rest =
        p.mode === 'straight'
          ? w.index === next.index
            ? p.setRest
            : p.transitionRest
          : w.set === next.set
            ? p.transitionRest
            : p.roundRest
      if (rest) stages.push({ phase: 'resting', seconds: rest })
    }
  })
  if (p.cooldown) stages.push({ phase: 'cooldown', seconds: p.cooldown })
  return stages
}
export function duration(p) {
  const t = timeline(p)
  return t.some((s) => s.seconds === null) ? null : t.reduce((a, s) => a + s.seconds, 0)
}
// Keep estimates separate from device measurements; never persist a derived RMR as measured.
export function restingEstimate(m, profile = {}, date) {
  const missing = []
  const weight = Number(m?.weight), height = Number(m?.height), age = Number(profile.age)
  if (!(Number.isFinite(weight) && weight > 0)) missing.push('bodyWeight')
  if (!(Number.isFinite(height) && height > 0)) missing.push('height')
  if (!(Number.isFinite(age) && age > 0)) missing.push('age')
  if (!['male', 'female'].includes(profile.sex)) missing.push('sex')
  if (missing.length) return { value: null, reason: 'missing', missing }
  const target = String(date || '').slice(0, 10)
  const reference = String(profile.ageDate || target).slice(0, 10)
  const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
  if (!validDate(target) || !validDate(reference))
    return { value: null, reason: 'date', missing: [] }
  let elapsed = Number(target.slice(0, 4)) - Number(reference.slice(0, 4))
  if (target.slice(5) < reference.slice(5)) elapsed--
  const effectiveAge = age + elapsed
  if (effectiveAge < 19 || effectiveAge > 59)
    return { value: null, reason: 'ageRange', missing: [] }
  return {
    value: 10 * weight + 6.25 * height - 5 * effectiveAge + (profile.sex === 'male' ? 5 : -161),
    reason: null, missing: [],
  }
}
export function rmr(m, profile, date) {
  const measured = Number(m?.rmr)
  if (Number.isFinite(measured) && measured > 0) return measured
  return restingEstimate(m, profile, date).value
}
export function energy(met, weight, minutes, resting) {
  if (!(met > 0 && weight > 0 && minutes > 0)) return { gross: null, net: null }
  const gross = ((met * 3.5 * weight) / 200) * minutes
  return {
    gross,
    net: resting === null ? null : Math.max(0, gross - (resting / 1440) * minutes),
  }
}
export function plannedWorkoutEnergy(plan, weight) {
  if (!plan.items.length) return null
  const effort = timeline(plan).filter((stage) => stage.phase === 'working')
  const minutes = effort.some((stage) => stage.seconds === null)
    ? plan.plannedActiveMinutes
    : effort.reduce((total, stage) => total + stage.seconds, 0) / 60
  return energy(plan.plannedMet, weight, minutes, null).gross
}
export const intake = (kcal, amount, mode = 'grams', serving = 100) =>
  mode === 'total'
    ? kcal
    : ((kcal * amount) / (mode === 'servings' ? 1 : 100)) *
      (mode === 'servings' ? serving / 100 : 1)
export function rangeSets(sessions, start, end, tz = 'Asia/Taipei') {
  return sessions
    .flatMap((s) => s.logs)
    .filter(
      (s) =>
        s.completedAt &&
        localDate(s.completedAt, tz) >= start &&
        localDate(s.completedAt, tz) <= end,
    )
}
export function measurementAt(measurements, date, tz = 'Asia/Taipei') {
  return (
    measurements
      .filter((m) => localDate(m.measuredAt, tz) <= date)
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0] || null
  )
}
export function dailyStats(data, date) {
  const meals = data.meals.filter((m) => m.date === date)
  const m = measurementAt(data.measurements, date, data.settings.timeZone)
  const resting = rmr(m, data.profile, date)
  const sessions = data.sessions
    .map((s) => ({ ...s, dayMinutes: minutesOnDate(s, date, data.settings.timeZone) }))
    .filter((s) => s.dayMinutes !== null)
  const estimates = sessions.map((s) => energy(s.met, m?.weight, s.dayMinutes, resting))
  const status = data.days[date] || {}
  const net = estimates.some((e) => e.net === null)
    ? null
    : sessions.length
      ? estimates.reduce((a, e) => a + e.net, 0)
      : status.noExercise
        ? 0
        : null
  const consumed = meals.reduce((a, m) => a + m.kcal, 0)
  const complete = Boolean(
    status.foodComplete && status.exerciseComplete && resting !== null && net !== null,
  )
  return {
    consumed,
    resting,
    net,
    complete,
    balance: complete ? consumed - resting - net : null,
    protein: meals.some((m) => m.protein == null)
      ? null
      : meals.reduce((a, m) => a + (m.protein || 0), 0),
    measurement: m,
  }
}
// Split UTC activity intervals at report-local date boundaries, including DST.
export function minutesOnDate(session, date, timeZone = 'Asia/Taipei') {
  const segments = session.activitySegments
  if (!segments?.length)
    return localDate(session.startedAt, timeZone) === date ? session.minutes : null
  let total = 0,
    day = 0
  for (const segment of segments) {
    let cursor = new Date(segment.start).getTime()
    const end = new Date(segment.end).getTime()
    total += (end - cursor) / 60000
    while (cursor < end) {
      const key = localDate(cursor, timeZone)
      let boundary = Math.min(end, cursor + 3600000)
      if (localDate(boundary - 1, timeZone) !== key) {
        let low = cursor,
          high = boundary
        while (high - low > 1) {
          const mid = Math.floor((low + high) / 2)
          if (localDate(mid, timeZone) === key) low = mid
          else high = mid
        }
        boundary = high
      }
      if (key === date) day += (boundary - cursor) / 60000
      cursor = boundary
    }
  }
  return day > 0 ? session.minutes * (day / total) : null
}
export function datesBetween(start, end) {
  const result = []
  for (
    let d = new Date(start + 'T00:00:00Z');
    d <= new Date(end + 'T00:00:00Z') && result.length < 3660;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    result.push(d.toISOString().slice(0, 10))
  return result
}
