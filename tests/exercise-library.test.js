import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { exercises, templates } from '../src/data/catalog.js'
import { clone, validatePlan, planDistribution } from '../src/services/domain.js'
import { validateExercise, visibleExercises, resolveExercise } from '../src/services/exerciseLibrary.js'
import { validateBackup } from '../src/repositories/database.js'
import { useAppStore, freshData } from '../src/stores/app.js'
import { emptySync, capture, mergeEvents, materialize, conflicts } from '../src/services/syncGraph.js'
const custom = () => ({ ...clone(exercises[0]), id: 'custom_test', name: { en: 'Orbit row', 'zh-TW': '環繞划船' } })
describe('personal exercise library', () => {
  it('validates bilingual names, known categories, equipment, IDs and primary parts', () => {
    expect(validateExercise(custom())).toBe(true)
    for (const change of [{ id: '../bad' }, { id: 123 }, { name: { en: ' ', 'zh-TW': '動作' } },
      { primary: [] }, { primary: ['unknown'] }, { requiredEquipment: ['unknown'] }, { type: 'bad' }])
      expect(validateExercise({ ...custom(), ...change })).toBe(false)
  })
  it('overrides built-ins and hides deleted definitions without losing references', () => {
    const edited = { ...clone(exercises[0]), name: { en: 'Personal push', 'zh-TW': '我的伏地挺身' } }
    expect(visibleExercises([edited]).find(e => e.id === edited.id).name.en).toBe('Personal push')
    const archived = { ...edited, deleted: true }
    expect(visibleExercises([archived]).some(e => e.id === archived.id)).toBe(false)
    expect(resolveExercise(archived.id, [archived]).name.en).toBe('Personal push')
    expect(exercises[0].name.en).toBe('Push-up')
  })
  it('accepts custom plan snapshots and keeps radar data independent of later changes', () => {
    const exercise = custom()
    const plan = { ...clone(templates[0]), name: 'Custom plan', items: [{ exerciseId: exercise.id, exercise: clone(exercise), mode: 'reps', target: 12, weight: 0 }] }
    expect(validatePlan(plan)).toBe(true)
    const before = planDistribution(plan)
    exercise.primary = ['core']
    expect(planDistribution(plan)).toEqual(before)
    plan.items[0].exercise.id = 'different'
    expect(validatePlan(plan)).toBe(false)
  })
  it('round-trips custom definitions and favorites and rejects corrupt backups', () => {
    const data = freshData(); data.exerciseLibrary = [custom()]; data.favorites = ['custom_test']
    const restored = validateBackup({ schemaVersion: 1, data: clone(data) })
    expect(restored.exerciseLibrary[0].name.en).toBe('Orbit row')
    const bad = clone(data); bad.exerciseLibrary.push(custom())
    expect(() => validateBackup({ schemaVersion: 1, data: bad })).toThrow('invalidBackup')
    const legacy = freshData(); delete legacy.exerciseLibrary
    expect(() => validateBackup({ schemaVersion: 1, data: legacy })).not.toThrow()
    expect(legacy).not.toHaveProperty('exerciseLibrary')
  })
  it('syncs library revisions to legacy workspaces and preserves concurrent edits', () => {
    const before = freshData(), a = clone(before), b = clone(before)
    a.exerciseLibrary = [custom()]; b.exerciseLibrary = [{ ...custom(), name: { en: 'Other row', 'zh-TW': '其他划船' } }]
    let id = 0
    const makeId = () => 'library_revision_' + (++id)
    const first = capture(emptySync(), before, a, makeId)
    const second = capture(emptySync(), before, b, makeId)
    expect(first.events[0].key).toBe('exerciseLibrary/custom_test')
    const old = clone(before); delete old.exerciseLibrary
    expect(materialize(first.events, old).exerciseLibrary[0].name.en).toBe('Orbit row')
    expect(conflicts(mergeEvents(first.events, second.events))).toHaveLength(1)
    const deleted = clone(a); deleted.exerciseLibrary[0].deleted = true
    const revision = capture(first, a, deleted, makeId)
    expect(materialize(revision.events, old).exerciseLibrary[0].deleted).toBe(true)
  })
  it('persists per-account CRUD while preserving existing plans on edit and delete', async () => {
    setActivePinia(createPinia())
    const app = useAppStore(); await app.init()
    await app.openAccount({ sub: 'library_account_a' })
    await app.saveExercise(custom())
    const planId = app.savePlan({ ...clone(templates[0]), name: 'Saved plan', items: [{ exerciseId: 'custom_test', mode: 'reps', target: 12, weight: 0 }] })
    await app.persist()
    await app.saveExercise({ ...custom(), name: { en: 'Changed row', 'zh-TW': '改名划船' }, primary: ['core'] })
    expect(app.data.plans.find(p => p.id === planId).items[0].exercise.name.en).toBe('Orbit row')
    await app.removeExercise('custom_test')
    expect(app.exercises.some(e => e.id === 'custom_test')).toBe(false)
    expect(validatePlan(app.data.plans[0])).toBe(true)
    expect(() => validateBackup(app.backup())).not.toThrow()
    await app.openAccount({ sub: 'library_account_b' })
    expect(app.data.exerciseLibrary).toEqual([])
    await app.openAccount({ sub: 'library_account_a' })
    expect(app.findExercise('custom_test').deleted).toBe(true)
    expect(app.data.plans[0].items[0].exercise.name.en).toBe('Orbit row')
  })
})
