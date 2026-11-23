import { describe, expect, it } from 'vitest'
import { profileAtMeasurement } from '../src/services/bodyProfile.js'
describe('single measurement date', () => {
  it('keeps a missing age empty instead of inventing one', () => {
    expect(profileAtMeasurement({ age: null, ageDate: '2025-11-23' }, '2026-11-23T12:00').age).toBeNull()
  })
  it('rebases legacy ages without modifying the stored profile', () => {
    const old = { age: 30, ageDate: '2025-11-23', sex: 'male' }
    const current = profileAtMeasurement(old, '2026-11-23T12:00')
    expect(current).toEqual({ age: 31, ageDate: '2026-11-23', sex: 'male' })
    expect(profileAtMeasurement(current, '2025-11-23T12:00')).toEqual(old)
    expect(old.age).toBe(30)
  })
  it('handles pre-anniversary dates and invalid or cleared input', () => {
    const p = { age: '30', ageDate: '2025-11-23' }
    expect(profileAtMeasurement(p, '2026-11-22T12:00').age).toBe(30)
    expect(profileAtMeasurement(p, '')).toEqual(p)
    expect(profileAtMeasurement(p, '2026-02-30T12:00')).toEqual(p)
  })
})
