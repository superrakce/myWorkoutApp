import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readData, writeData, validateBackup } from '../repositories/database.js'
import { clone, localDate, uid } from '../services/domain.js'
export const freshData = () => ({
  profile: { age: null, sex: '', ageDate: localDate() },
  settings: { timeZone: 'Asia/Taipei', musicVolume: 0.35, cueVolume: 0.25 },
  plans: [],
  sessions: [],
  meals: [],
  measurements: [],
  favorites: [],
  days: {},
  active: null,
})
export const useAppStore = defineStore('app', () => {
  const data = ref(freshData()),
    ready = ref(false),
    error = ref(''),
    notice = ref('')
  let saving = Promise.resolve(),
    timer
  async function init() {
    try {
      const stored = await readData()
      if (stored) data.value = stored
      if (data.value.active && !['completed', 'aborted'].includes(data.value.active.status)) {
        data.value.active.status = 'paused'
        notice.value = 'restored'
      }
    } catch {
      error.value = 'storageError'
    }
    ready.value = true
  }
  function persist() {
    clearTimeout(timer)
    const snapshot = clone(data.value)
    saving = saving
      .catch(() => {})
      .then(() => writeData(snapshot))
      .catch(() => {
        error.value = 'storageError'
        throw Error('storageError')
      })
    return saving
  }
  watch(
    data,
    () => {
      if (ready.value) {
        // Persist business edits immediately; timer progress is checkpointed by the player.
        if (
          !data.value.active ||
          ['ready', 'paused', 'completed', 'aborted'].includes(data.value.active.status)
        ) {
          persist().catch(() => {})
        } else {
          clearTimeout(timer)
          timer = setTimeout(() => persist().catch(() => {}), 500)
        }
      }
    },
    { deep: true, flush: 'sync' },
  )
  function savePlan(p) {
    const value = clone(p)
    value.updatedAt = new Date().toISOString()
    if (!value.id) value.id = uid()
    const i = data.value.plans.findIndex((x) => x.id === value.id)
    if (i < 0) data.value.plans.push(value)
    else data.value.plans[i] = value
    return value.id
  }
  function toggleFavorite(id) {
    const i = data.value.favorites.indexOf(id)
    if (i < 0) data.value.favorites.push(id)
    else data.value.favorites.splice(i, 1)
  }
  function backup() {
    return {
      schemaVersion: 1,
      dataVersion: '2026-11-v1',
      mappingVersion: 1,
      exportedAt: new Date().toISOString(),
      data: clone(data.value),
    }
  }
  async function restore(b) {
    const restored = clone(validateBackup(b))
    if (restored.active && !['completed', 'aborted'].includes(restored.active.status))
      restored.active.status = 'paused'
    await saving.catch(() => {})
    await writeData(restored)
    data.value = restored
    await persist()
  }
  async function reset() {
    await restore({ schemaVersion: 1, data: freshData() })
  }
  return {
    data,
    ready,
    error,
    notice,
    init,
    persist,
    savePlan,
    toggleFavorite,
    backup,
    restore,
    reset,
  }
})
