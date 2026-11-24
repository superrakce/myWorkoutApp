import { describe, it, expect } from 'vitest'
import { exercises, templates, item, axes } from '../src/data/catalog.js'
import {
  filterExercises,
  distribution,
  planDistribution,
  timeline,
  validatePlan,
  duration,
  rmr,
  restingEstimate,
  energy,
  plannedWorkoutEnergy,
  intake,
  rangeSets,
  measurementAt,
  dailyStats,
  clone,
  minutesOnDate,
} from '../src/services/domain.js'
const plan = {
  ...clone(templates[0]),
  mode: 'straight',
  sets: 2,
  prepare: 0,
  cooldown: 0,
  items: [item('pushup'), item('row')],
}
describe('workout timeline', () => {
  it('uses straight order and one rest boundary', () => {
    const steps = timeline(plan)
    expect(steps.filter((s) => s.phase === 'working').map((s) => s.exerciseId + s.set)).toEqual([
      'pushup1',
      'pushup2',
      'row1',
      'row2',
    ])
    expect(steps.filter((s) => s.phase === 'resting').map((s) => s.seconds)).toEqual([30, 20, 30])
    expect(steps.at(-1).phase).toBe('working')
  })
  it('uses circuit order and round rest', () => {
    const steps = timeline({ ...plan, mode: 'circuit' })
    expect(steps.filter((s) => s.phase === 'working').map((s) => s.exerciseId + s.set)).toEqual([
      'pushup1',
      'row1',
      'pushup2',
      'row2',
    ])
    expect(steps.filter((s) => s.phase === 'resting').map((s) => s.seconds)).toEqual([20, 60, 20])
  })
  it('handles zero rest, single set and Tabata', () => {
    expect(duration(templates[2])).toBe(245)
    expect(duration({ ...templates[2], prepare: 0 })).toBe(240)
    expect(duration(plan)).toBeNull()
    expect(timeline({ ...plan, sets: 1, items: [item('pushup')] })).toHaveLength(1)
  })
  it('uses timed movements and one uniform rest between Tabata efforts', () => {
    const tabata = {
      ...templates[2],
      name: 'Intervals',
      sets: 2,
      items: plan.items.map((item) => ({ ...item, mode: 'time', target: 20 })),
    }
    expect(validatePlan(tabata)).toBe(true)
    expect(validatePlan({ ...tabata, items: plan.items })).toBe(false)
    expect(timeline(tabata).map(({ phase, seconds }) => [phase, seconds])).toEqual([
      ['preparing', 5], ['working', 20], ['resting', 10], ['working', 20],
      ['resting', 10], ['working', 20], ['resting', 10], ['working', 20], ['cooldown', 10],
    ])
  })
  it('estimates plan calories from active time, MET and body weight', () => {
    const timed = { ...templates[2], plannedMet: 6 }
    expect(plannedWorkoutEnergy(timed, 70)).toBeCloseTo(19.6)
    expect(plannedWorkoutEnergy(timed, undefined)).toBeNull()
    expect(plannedWorkoutEnergy(plan, 70)).toBeNull()
    expect(plannedWorkoutEnergy({ ...plan, plannedMet: 6, plannedActiveMinutes: 2 }, 70)).toBeCloseTo(14.7)
  })
})
describe('equipment semantics', () => {
  it('excludes unknown equipment and empty inventory in owned mode', () => {
    expect(filterExercises(exercises, { equipment: [], owned: true })).toHaveLength(0)
    expect(
      filterExercises([{ ...exercises[0], requiredEquipment: [] }], {
        equipment: ['bodyweight'],
        owned: true,
      }),
    ).toHaveLength(0)
  })
  it('combines chest AND dumbbell', () => {
    const list = filterExercises(exercises, {
      part: 'chest',
      equipment: ['dumbbell'],
    })
    expect(list.map((e) => e.id)).toEqual(['press'])
  })
  it('uses OR equipment and ALL required equipment in owned mode', () => {
    expect(
      filterExercises(exercises, {
        equipment: ['bodyweight'],
        owned: true,
      }).some((e) => e.id === 'pullup'),
    ).toBe(false)
    expect(
      filterExercises(exercises, { equipment: ['bodyweight'] }).some((e) => e.id === 'pullup'),
    ).toBe(true)
    expect(
      filterExercises(exercises, {
        equipment: ['bodyweight', 'pullup'],
        owned: true,
      }).some((e) => e.id === 'pullup'),
    ).toBe(true)
  })
  it('does not treat unknown as bodyweight; searches both languages', () => {
    expect(
      filterExercises([{ ...exercises[0], equipment: [], requiredEquipment: [] }], {
        equipment: ['bodyweight'],
      }),
    ).toEqual([])
    expect(filterExercises(exercises, { query: '伏地挺身' }).length).toBeGreaterThan(0)
  })
})
describe('shared radar calculation', () => {
  const make = (id) => ({ exerciseId: id, status: 'completed' })
  it('six single axes each contribute three sets', () => {
    const d = planDistribution({
      ...plan,
      sets: 3,
      items: ['pushup', 'row', 'shoulderpress', 'curl', 'squat', 'plank'].map(item),
    })
    expect(axes.map((a) => d.values[a])).toEqual([3, 3, 3, 3, 3, 3])
    expect(d.total).toBe(18)
    expect(d.percent.chest).toBeCloseTo(16.6667)
  })
  it('actual values exclude skips, recovery and unconfirmed sets', () => {
    const d = distribution([
      ...Array(3).fill(make('pushup')),
      ...Array(3).fill(make('row')),
      { ...make('plank'), status: 'skipped' },
      make('wrist'),
    ])
    expect(d.percent.chest).toBe(50)
    expect(d.percent.back).toBe(50)
    expect(d.total).toBe(6)
  })
  it('splits unique axes and paired unilateral sets', () => {
    expect(distribution([make('mountain')]).values.chest).toBe(0.5)
    expect(distribution([make('squat')]).values.lower_body).toBe(1)
    expect(distribution([{ ...make('curl'), side: 'left' }]).total).toBe(0.5)
    expect(
      distribution([
        {
          status: 'completed',
          exercise: { type: 'strength', primary: ['wrist'] },
        },
      ]).unclassified,
    ).toBe(1)
  })
  it('filters each set by local completion date including cross-midnight', () => {
    const sessions = [
      {
        logs: [
          { ...make('pushup'), completedAt: '2026-11-20T15:59:00Z' },
          { ...make('row'), completedAt: '2026-11-20T16:01:00Z' },
        ],
      },
    ]
    expect(distribution(rangeSets(sessions, '2026-11-21', '2026-11-21')).total).toBe(1)
    expect(distribution(rangeSets([], '2026-11-21', '2026-11-21')).total).toBe(0)
  })
})
describe('energy and nutrition', () => {
  it('splits a session over midnight without double-counting and rescales edited minutes', () => {
    const session = {
      startedAt: '2026-11-20T15:50:00Z',
      minutes: 20,
      activitySegments: [{ start: '2026-11-20T15:50:00Z', end: '2026-11-20T16:10:00Z' }],
    }
    expect(minutesOnDate(session, '2026-11-20')).toBe(10)
    expect(minutesOnDate(session, '2026-11-21')).toBe(10)
    expect(minutesOnDate({ ...session, minutes: 10 }, '2026-11-21')).toBe(5)
    expect(minutesOnDate(session, '2026-11-22')).toBeNull()
  })
  it('matches specification formulas', () => {
    const r = rmr({ weight: 70, height: 175 }, { age: 30, sex: 'male' }, '2026-11-21')
    expect(r).toBe(1648.75)
    const e = energy(6, 70, 30, r)
    expect(e.gross).toBe(220.5)
    expect(e.net).toBeCloseTo(186.151, 3)
    expect(energy(6, 70, 30, null).net).toBeNull()
  })
  it('handles grams, servings, and total without multiplying twice', () => {
    expect(intake(150, 80)).toBe(120)
    expect(intake(150, 2, 'servings', 80)).toBe(240)
    expect(intake(150, 80, 'total')).toBe(150)
  })
  it('does not backfill old dates; takes last measurement', () => {
    const measurements = [
      { measuredAt: '2026-11-21T01:00:00Z', weight: 70 },
      { measuredAt: '2026-11-21T03:00:00Z', weight: 71 },
    ]
    expect(measurementAt(measurements, '2026-11-20')).toBeNull()
    expect(measurementAt(measurements, '2026-11-21').weight).toBe(71)
  })
  it('retains missing values and uses correct balance sign', () => {
    const data = {
      measurements: [{ measuredAt: '2026-11-21T00:00:00Z', weight: 70, rmr: 1600 }],
      profile: {},
      settings: { timeZone: 'Asia/Taipei' },
      meals: [{ date: '2026-11-21', kcal: 2000 }],
      sessions: [],
      days: {},
    }
    expect(dailyStats(data, '2026-11-21').balance).toBeNull()
    data.days['2026-11-21'] = {
      foodComplete: true,
      exerciseComplete: true,
      noExercise: true,
    }
    expect(dailyStats(data, '2026-11-21').balance).toBe(400)
    expect(2000 - 1600 - 300).toBe(100)
  })
})

describe('resting estimate diagnostics', () => {
  const m = { weight: 70, height: 175 }
  const p = { age: 30, sex: 'male', ageDate: '2026-11-23' }
  it('reports the specific missing profile fields despite available BMI data', () => {
    expect(restingEstimate(m, {}, '2026-11-23')).toEqual({
      value: null, reason: 'missing', missing: ['age', 'sex'],
    })
    expect(restingEstimate(m, { ...p, age: '' }, '2026-11-23').missing).toEqual(['age'])
  })
  it('normalizes imported numbers and returns finite results', () => {
    expect(rmr({ weight: '70', height: '175' }, { ...p, age: '30' }, '2027-11-23')).toBe(1643.75)
    expect(restingEstimate({ ...m, weight: Infinity }, p, '2026-11-23').value).toBeNull()
    expect(rmr({ ...m, rmr: Infinity }, p, '2026-11-23')).toBe(1648.75)
  })
  it('validates the age on the selected date and rejects invalid dates', () => {
    expect(restingEstimate(m, { ...p, age: 59 }, '2027-11-23').reason).toBe('ageRange')
    expect(restingEstimate(m, { ...p, age: 18 }, '2027-11-23').value).toBe(1703.75)
    expect(restingEstimate(m, p, 'not-a-date').reason).toBe('date')
    expect(restingEstimate(m, { ...p, ageDate: '2026-02-30' }, '2026-11-23').reason).toBe('date')
  })
  it('keeps measured energy distinct from the automatic estimate', () => {
    expect(rmr({ ...m, rmr: 1500 }, p, '2026-11-23')).toBe(1500)
    expect(restingEstimate({ ...m, rmr: 1500 }, p, '2026-11-23').value).toBe(1648.75)
  })
})
