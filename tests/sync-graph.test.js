import {describe,it,expect} from 'vitest'
import {emptySync,capture,mergeEvents,mergeRemote,materialize,conflicts,resolveVersion,importRecords,records,FORMAT} from '../src/services/syncGraph.js'
const fresh=()=>({profile:{age:30},settings:{timeZone:'Asia/Taipei'},plans:[],sessions:[],meals:[],measurements:[],favorites:[],days:{},active:null})
const copy=x=>JSON.parse(JSON.stringify(x))
let counter=0
const id=()=>('revision_'+String(++counter).padStart(6,'0'))
const log=(key,value,parents=[],deleted=false)=>({format:FORMAT,id:id(),key,value,parents,deleted})
describe('immutable per-record sync',()=>{
 it('merges different records without replacing entire datasets',()=>{
  const a=fresh(),b=fresh();a.meals.push({id:'meal_a',kcal:120});b.plans.push({id:'plan_b',name:'Plan'})
  const sa=capture(emptySync(),fresh(),a,id),sb=capture(emptySync(),fresh(),b,id)
  const result=materialize(mergeEvents(sa.events,sb.events),fresh())
  expect(result.meals).toHaveLength(1);expect(result.plans).toHaveLength(1)
 })
 it('extends a known parent when editing offline',()=>{
  const a=fresh();a.meals=[{id:'meal_a',kcal:120}]
  const one=capture(emptySync(),fresh(),a,id),b=copy(a);b.meals[0].kcal=150
  const two=capture(one,a,b,id)
  expect(two.events[1].parents).toEqual([one.events[0].id]);expect(conflicts(two.events)).toHaveLength(0)
 })
 it('preserves concurrent edits until explicit resolution',()=>{
  const first=log('meals/meal_a',{id:'meal_a',kcal:100}),a=log(first.key,{id:'meal_a',kcal:120},[first.id]),b=log(first.key,{id:'meal_a',kcal:150},[first.id])
  const sync={...emptySync(),events:mergeEvents([first,a,b])},current=fresh();current.meals=[a.value]
  expect(conflicts(sync.events)).toHaveLength(1);expect(materialize(sync.events,current).meals[0].kcal).toBe(120)
  const resolved=resolveVersion(sync,first.key,b.id,id)
  expect(conflicts(resolved.events)).toHaveLength(0);expect(materialize(resolved.events,current).meals[0].kcal).toBe(150)
  expect(resolved.events).toHaveLength(4)
 })
 it('preserves delete/edit conflicts and does not resurrect deleted records',()=>{
  const first=log('plans/plan_a',{id:'plan_a',name:'Original'}),deleted=log(first.key,null,[first.id],true),edited=log(first.key,{id:'plan_a',name:'Edited'},[first.id])
  const sync={...emptySync(),events:mergeEvents([first,deleted,edited])},current=fresh();current.plans=[edited.value]
  const resolved=resolveVersion(sync,first.key,deleted.id,id)
  expect(materialize(resolved.events,current).plans).toEqual([])
  expect(conflicts(mergeEvents(resolved.events,[first,edited]))).toHaveLength(0)
 })
 it('deduplicates request retries but rejects conflicting content for the same revision',()=>{
  const e=log('profile',{age:30})
  expect(mergeEvents([e],[copy(e)])).toHaveLength(1)
  expect(()=>mergeEvents([e],[{...e,value:{age:31}}])).toThrow('syncCorrupt')
 })
 it('rejects unknown formats, broken parents, cross-record parents and cycles',()=>{
  const e=log('profile',{age:30}),b=log('settings',{},[e.id])
  expect(()=>mergeEvents([{...e,format:'future'}])).toThrow()
  expect(()=>mergeEvents([{...e,parents:['missing_parent']}])).toThrow()
  expect(()=>mergeEvents([e,b])).toThrow()
  const x=log('profile',{}),y=log('profile',{},[x.id]);x.parents=[y.id]
  expect(()=>mergeEvents([x,y])).toThrow()
 })
 it('acks only uploads confirmed by Drive while keeping later edits pending',()=>{
  const one=log('profile',{age:30}),two=log('settings',{}),sync={...emptySync(),events:[one,two],pending:[one.id,two.id]}
  const result=mergeRemote(sync,fresh(),[],[one.id],{file_a:'hash'})
  expect(result.sync.pending).toEqual([two.id]);expect(result.sync.files).toEqual({file_a:'hash'})
 })
 it('keeps both versions when imported guest IDs collide',()=>{
  const existing=log('meals/meal_a',{id:'meal_a',kcal:120}),current=fresh(),guest=fresh()
  current.meals=[existing.value];guest.meals=[{id:'meal_a',kcal:150}]
  const result=importRecords({...emptySync(),events:[existing]},current,guest,fresh(),id)
  expect(conflicts(result.sync.events)).toHaveLength(1);expect(result.data.meals[0].kcal).toBe(120);expect(guest.meals[0].kcal).toBe(150)
 })
 it('does not serialize live player or derived chart state',()=>{
  const data=fresh();data.active={accessToken:'not-a-real-token',status:'working'};data.radar=[1,2]
  expect(JSON.stringify(records(data))).not.toContain('not-a-real-token')
  expect(records(data)).not.toHaveProperty('active');expect(records(data)).not.toHaveProperty('radar')
 })
 it('does not manufacture conflicts for identical independently-created values',()=>{
  const a=log('profile',{age:30}),b=log('profile',{age:30})
  expect(conflicts(mergeEvents([a,b]))).toHaveLength(0)
 })
 it('normal edits do not silently resolve an existing conflict',()=>{
  const a=log('profile',{age:30}),b=log('profile',{age:31}),before=fresh(),after=fresh();after.profile.age=32
  const result=capture({...emptySync(),events:[a,b]},before,after,id)
  expect(conflicts(result.events)).toHaveLength(1)
 })
})
