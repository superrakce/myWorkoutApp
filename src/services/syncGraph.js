// Immutable per-record revisions form a DAG. Conflicting heads are never chosen by time.
export const FORMAT = 'form-drive-v1'
export const COLLECTIONS = ['plans','sessions','meals','measurements']
const copy = v => JSON.parse(JSON.stringify(v))
export function canonical(v) {
  if(Array.isArray(v)) return '['+v.map(canonical).join(',')+']'
  if(v && typeof v==='object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'
  return JSON.stringify(v)
}
export const emptySync = () => ({format:FORMAT,events:[],pending:[],files:{},enabled:false,lastSync:null,reviewRequired:false})
export function records(data) {
  const result = {'profile':copy(data.profile),'settings':copy(data.settings),'favorites':copy(data.favorites)}
  for(const key of COLLECTIONS) for(const row of data[key]) result[key+'/'+row.id]=copy(row)
  for(const [date,status] of Object.entries(data.days)) result['days/'+date]=copy(status)
  return result
}
function validKey(key) {
  return ['profile','settings','favorites'].includes(key) ||
    /^(plans|sessions|meals|measurements)\/[^/]{1,200}$/.test(key) ||
    /^days\/\d{4}-\d{2}-\d{2}$/.test(key)
}
export function validateEvent(event) {
  if(!event || event.format!==FORMAT || typeof event.id!=='string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(event.id) ||
     !validKey(event.key) || !Array.isArray(event.parents) || event.parents.length>100 ||
     event.parents.some(p=>typeof p!=='string'||p===event.id) || new Set(event.parents).size!==event.parents.length ||
     typeof event.deleted!=='boolean' || !('value' in event) || event.deleted && event.value!==null) throw Error('syncCorrupt')
  if(!event.deleted) {
    const v=event.value
    if(event.key==='favorites' ? !Array.isArray(v) : !v || typeof v!=='object' || Array.isArray(v)) throw Error('syncCorrupt')
    if(COLLECTIONS.some(c=>event.key.startsWith(c+'/')) && v.id!==event.key.slice(event.key.indexOf('/')+1)) throw Error('syncCorrupt')
  }
  return event
}
export function mergeEvents(...groups) {
  const all=new Map()
  for(const e of groups.flat()) {
    validateEvent(e)
    if(all.has(e.id) && canonical(all.get(e.id))!==canonical(e)) throw Error('syncCorrupt')
    all.set(e.id,copy(e))
  }
  for(const e of all.values()) for(const p of e.parents)
    if(!all.has(p)||all.get(p).key!==e.key) throw Error('syncCorrupt')
  const done=new Set(),visiting=new Set()
  function visit(id){if(visiting.has(id))throw Error('syncCorrupt');if(done.has(id))return;visiting.add(id);for(const p of all.get(id).parents)visit(p);visiting.delete(id);done.add(id)}
  for(const id of all.keys()) visit(id)
  return [...all.values()]
}
export function heads(events) {
  const referenced=new Set(events.flatMap(e=>e.parents)),result={}
  for(const e of events) if(!referenced.has(e.id)) (result[e.key] ||= []).push(e)
  for(const list of Object.values(result)) list.sort((a,b)=>a.id.localeCompare(b.id))
  return result
}
const valueOf = e => e.deleted?undefined:e.value
const same = (a,b) => canonical(a)===canonical(b)
export function conflicts(events) {
  return Object.entries(heads(events)).filter(([,list])=>new Set(list.map(e=>canonical(valueOf(e)))).size>1)
    .map(([key,versions])=>({key,versions}))
}
export function materialize(events,current) {
  const result=copy(current)
  for(const [key,list] of Object.entries(heads(events))) {
    if(new Set(list.map(e=>canonical(valueOf(e)))).size>1) continue
    const event=list[0],value=valueOf(event)
    if(['profile','settings','favorites'].includes(key)) {
      if(event.deleted) throw Error('syncCorrupt')
      result[key]=copy(value)
    } else {
      const split=key.indexOf('/'),collection=key.slice(0,split),id=key.slice(split+1)
      if(collection==='days') {if(event.deleted)delete result.days[id];else result.days[id]=copy(value)}
      else {result[collection]=result[collection].filter(v=>v.id!==id);if(!event.deleted)result[collection].push(copy(value))}
    }
  }
  return result
}
export function capture(sync,before,after,makeId=()=>crypto.randomUUID()) {
  const previous=records(before),next=records(after),graph=heads(sync.events),added=[]
  for(const key of new Set([...Object.keys(previous),...Object.keys(next)])) {
    if(same(previous[key],next[key])) continue
    const list=graph[key]||[]
    // A normal edit only extends the version the user actually saw, preserving other branches.
    const matching=list.filter(e=>same(valueOf(e),previous[key]))
    const event={format:FORMAT,id:makeId(),key,parents:matching.map(e=>e.id),deleted:!(key in next),value:key in next?next[key]:null}
    added.push(event)
  }
  return {...sync,events:mergeEvents(sync.events,added),pending:[...new Set([...sync.pending,...added.map(e=>e.id)])]}
}
export function resolveVersion(sync,key,chosenId,makeId=()=>crypto.randomUUID()) {
  const list=heads(sync.events)[key]||[],chosen=list.find(e=>e.id===chosenId)
  if(!chosen) throw Error('syncCorrupt')
  const event={...copy(chosen),id:makeId(),parents:list.map(e=>e.id)}
  return {...sync,events:mergeEvents(sync.events,[event]),pending:[...new Set([...sync.pending,event.id])]}
}
export function importRecords(sync,current,incoming,defaults,makeId=()=>crypto.randomUUID()) {
  const from=records(incoming),to=records(current),blank=records(defaults),added=[]
  for(const [key,value] of Object.entries(from)) {
    if(same(value,to[key]) || same(value,blank[key]))continue
    // Imported records have no ancestry claim over existing cloud data.
    added.push({format:FORMAT,id:makeId(),key,parents:[],deleted:false,value:copy(value)})
  }
  const events=mergeEvents(sync.events,added)
  return {sync:{...sync,events,pending:[...new Set([...sync.pending,...added.map(e=>e.id)])]},data:materialize(events,current)}
}
export function mergeRemote(sync,current,remote,uploaded=[],fileIndex={}) {
  const events=mergeEvents(sync.events,remote)
  return {sync:{...sync,events,pending:sync.pending.filter(id=>!uploaded.includes(id)),files:copy(fileIndex)},data:materialize(events,current)}
}
export function hasBusinessData(data,defaults) {return canonical(records(data))!==canonical(records(defaults))}
