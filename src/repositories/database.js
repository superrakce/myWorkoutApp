const dbName = 'form-workout-v1'
export function openDatabase() {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(dbName,1)
    r.onupgradeneeded=()=>r.result.createObjectStore('state')
    r.onsuccess=()=>resolve(r.result)
    r.onerror=()=>reject(r.error)
  })
}
export async function readWorkspace(scope='guest') {
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readonly'),store=tx.objectStore('state')
    let result
    const r=store.get('workspace:'+scope)
    r.onsuccess=()=>{result=r.result;if(!result&&scope==='guest'){const legacy=store.get('app');legacy.onsuccess=()=>{if(legacy.result)result={data:legacy.result}}}}
    tx.oncomplete=()=>{db.close();resolve(result)}
    tx.onerror=()=>{db.close();reject(tx.error)}
  })
}
export async function writeWorkspace(scope,workspace,expectedRevision) {
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state')
    let revision=0,conflict=false
    const read=store.get('workspace:'+scope)
    read.onsuccess=()=>{
      revision=read.result?.revision||0
      if(expectedRevision!==undefined&&expectedRevision!==revision){conflict=true;tx.abort();return}
      revision++
      store.put({...JSON.parse(JSON.stringify(workspace)),revision},'workspace:'+scope)
    }
    tx.oncomplete=()=>{db.close();resolve(revision)}
    tx.onerror=()=>{db.close();reject(tx.error)}
    tx.onabort=()=>{db.close();reject(conflict?Error('syncLocalChanged'):tx.error||Error('storageError'))}
  })
}
export async function readData(scope='guest'){return (await readWorkspace(scope))?.data}
export async function writeData(data,scope='guest'){return writeWorkspace(scope,{data})}
import { validatePlan } from '../services/domain.js'
import { resolveExercise, validateExercise } from '../services/exerciseLibrary.js'
export function validateBackup(b) {
  const fail = () => {
      throw Error('invalidBackup')
    },
    obj = (x) => x && typeof x === 'object' && !Array.isArray(x),
    num = (x) => Number.isFinite(x) && x >= 0,
    stamp = (x) => typeof x === 'string' && Number.isFinite(new Date(x).getTime()),
    date = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && stamp(x),
    ids = (list) => {
      if (!Array.isArray(list)) fail()
      const seen = new Set()
      for (const v of list) {
        if (!obj(v) || typeof v.id !== 'string' || !v.id || seen.has(v.id)) fail()
        seen.add(v.id)
      }
    }
  if (b?.schemaVersion !== 1 || !obj(b.data)) fail()
  const d = b.data
  const library = d.exerciseLibrary === undefined ? [] : d.exerciseLibrary
  ids(library)
  if (library.some(e => !validateExercise(e))) fail()
  const findExercise = id => resolveExercise(id, library)
  for (const k of ['plans', 'sessions', 'meals', 'measurements']) ids(d[k])
  if (
    !obj(d.profile) ||
    !obj(d.settings) ||
    !obj(d.days) ||
    !Array.isArray(d.favorites) ||
    d.favorites.some((id) => !findExercise(id)) ||
    !('active' in d)
  )
    fail()
  try {
    new Intl.DateTimeFormat('en', { timeZone: d.settings.timeZone })
  } catch {
    fail()
  }
  if (![d.settings.musicVolume, d.settings.cueVolume].every((v) => num(v) && v <= 1)) fail()
  for (const [key, v] of Object.entries(d.days))
    if (!date(key) || !obj(v) || Object.values(v).some((b) => typeof b !== 'boolean')) fail()
  for (const p of d.plans)
    if (
      !Array.isArray(p.items) ||
      !validatePlan({
        ...p,
        items: p.items.length
          ? p.items
          : [{ exerciseId: 'pushup', mode: p.tabata ? 'time' : 'reps', target: 1, weight: 0 }],
      }, findExercise)
    )
      fail()
  const validateSession = (s) => {
    if (
      !obj(s) ||
      typeof s.id !== 'string' ||
      !stamp(s.startedAt) ||
      !obj(s.snapshot) ||
      typeof s.snapshot.name !== 'string' ||
      !Array.isArray(s.logs) ||
      !num(s.minutes) ||
      !num(s.met) ||
      ![
        'completed',
        'partial',
        'aborted',
        'ready',
        'paused',
        'preparing',
        'working',
        'resting',
        'cooldown',
      ].includes(s.status)
    )
      fail()
    ids(s.logs)
    for (const l of s.logs)
      if (
        !obj(l.exercise) ||
        !obj(l.exercise.name) ||
        !['en', 'zh-TW'].every((k) => typeof l.exercise.name[k] === 'string') ||
        !Array.isArray(l.exercise.primary) ||
        l.exercise.primary.some((x) => typeof x !== 'string') ||
        !num(l.actual) ||
        !num(l.weight) ||
        !stamp(l.completedAt) ||
        !['completed', 'skipped'].includes(l.status)
      )
        fail()
  }
  for (const s of d.sessions) validateSession(s)
  if (d.active !== null) {
    validateSession(d.active)
    if (
      !Array.isArray(d.active.stages) ||
      !Number.isInteger(d.active.cursor) ||
      d.active.cursor < 0 ||
      d.active.cursor > d.active.stages.length ||
      !num(d.active.elapsed) ||
      !num(d.active.activeSeconds)
    )
      fail()
    for (const st of d.active.stages)
      if (
        !['working', 'resting', 'preparing', 'cooldown'].includes(st.phase) ||
        (st.seconds !== null && !num(st.seconds)) ||
        (st.phase === 'working' && !(st.exercise
          ? st.exercise.id === st.exerciseId && validateExercise(st.exercise)
          : findExercise(st.exerciseId)))
      )
        fail()
  }
  for (const m of d.meals)
    if (
      !date(m.date) ||
      !num(m.kcal) ||
      typeof m.name !== 'string' ||
      !['breakfast', 'lunch', 'dinner', 'snack'].includes(m.meal) ||
      !['protein', 'carbs', 'fat'].every((k) => m[k] == null || num(m[k]))
    )
      fail()
  for (const m of d.measurements)
    if (
      !num(m.weight) ||
      m.weight === 0 ||
      !stamp(m.measuredAt) ||
      (m.height != null && (!num(m.height) || m.height === 0)) ||
      (m.bodyFat != null && (!num(m.bodyFat) || m.bodyFat > 100))
    )
      fail()
  return d
}
