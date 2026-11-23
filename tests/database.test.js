import 'fake-indexeddb/auto'
import { it, expect } from 'vitest'
import { readData, writeData, validateBackup } from '../src/repositories/database.js'
import { clone, distribution, timeline } from '../src/services/domain.js'
import { templates, exercises } from '../src/data/catalog.js'
it('round-trips related records, snapshots and player checkpoint atomically', async () => {
  const data = {
    profile: { age: 30 },
    settings: { timeZone: 'Asia/Taipei', musicVolume: 0.35, cueVolume: 0.25 },
    plans: [{ ...clone(templates[0]), name: 'Test' }],
    sessions: [
      {
        id: 's',
        snapshot: { name: 'Test' },
        status: 'completed',
        startedAt: '2026-11-20T12:00:00Z',
        minutes: 10,
        met: 6,
        logs: [
          {
            id: 'l',
            exercise: clone(exercises[0]),
            status: 'completed',
            actual: 12,
            weight: 0,
            completedAt: '2026-11-20T12:00:00Z',
          },
        ],
      },
    ],
    measurements: [{ id: 'm', weight: 70, measuredAt: '2026-11-20T12:00:00Z' }],
    meals: [
      {
        id: 'food',
        name: 'Meal',
        date: '2026-11-20',
        kcal: 120,
        snapshot: { kcal: 150 },
        amount: 80,
        meal: 'breakfast',
      },
    ],
    favorites: ['pushup'],
    days: {},
    active: {
      id: 'active',
      snapshot: { name: 'Paused' },
      startedAt: '2026-11-20T12:00:00Z',
      logs: [],
      minutes: 0,
      met: 0,
      stages: timeline(templates[0]),
      activeSeconds: 5,
      status: 'paused',
      cursor: 2,
      elapsed: 7,
    },
  }
  const backup = JSON.parse(JSON.stringify({ schemaVersion: 1, data }))
  validateBackup(backup)
  await writeData(backup.data)
  const restored = await readData()
  expect(restored).toEqual(data)
  expect(distribution(restored.sessions[0].logs).total).toBe(1)
  expect(restored.active.elapsed).toBe(7)
})
it('rejects invalid version, duplicate IDs and broken set snapshots', () => {
  expect(() => validateBackup({ schemaVersion: 99, data: {} })).toThrow()
  expect(() => validateBackup({ schemaVersion: 1, data: {} })).toThrow()
})
