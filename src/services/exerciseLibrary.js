import { exercises, parts, equipment } from '../data/catalog.js'
export function validateExercise(e) {
  const strings = (v, max = 200) => Array.isArray(v) && v.length <= max && v.every(s => typeof s === 'string' && s.length <= 2000)
  const selected = (v, choices) => strings(v) && new Set(v).size === v.length && v.every(s => choices.includes(s))
  return Boolean(e && typeof e.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(e.id) &&
    e.name && ['en', 'zh-TW'].every(k => typeof e.name[k] === 'string' && e.name[k].trim() && e.name[k].length <= 120) &&
    ['strength', 'cardio', 'mobility', 'recovery'].includes(e.type) &&
    ['beginner', 'intermediate', 'advanced'].includes(e.difficulty) &&
    ['reps', 'time'].includes(e.mode) && selected(e.primary, parts) && e.primary.length &&
    selected(e.secondary, parts) && selected(e.equipment, equipment) &&
    selected(e.requiredEquipment, e.equipment) && strings(e.aliases, 50) &&
    e.steps && ['en', 'zh-TW'].every(k => strings(e.steps[k], 30)) &&
    (e.deleted == null || typeof e.deleted === 'boolean'))
}
export function resolveExercise(id, library = []) {
  return library.find(e => e.id === id) || exercises.find(e => e.id === id)
}
export function visibleExercises(library = []) {
  const all = new Map(exercises.map(e => [e.id, e]))
  for (const e of library) all.set(e.id, e)
  return [...all.values()].filter(e => !e.deleted)
}
